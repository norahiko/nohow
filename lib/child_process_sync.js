"use strict";

var helper = require("./helper.js");
var tools = require("./tools.js");
var assert = require("assert");
var child_process = require("child_process");
var constants = require("constants");
var fs = require("fs");

var polyfill = null;
var stdinFile, stdoutFile, stderrFile;

if(child_process.spawnSync === undefined) {
    try {
        polyfill = require("../build/Release/polyfill.node");
    } catch(_) {
        polyfill = require("../build/Debug/polyfill.node");
    }
    stdinFile = tools.tempfile();
    stdoutFile = tools.tempfile();
    stderrFile = tools.tempfile();
}


var errorCodeMap = Object.create(null);

for(var code in constants) {
    if(code[0] === "E") {   // code == Error code
        errorCodeMap[constants[code]] = code;
    }
}


// ----------------------------------------
// exports

exports.spawn = function spawn(executable, args, options) {
    var proc = new ProcessSync(executable, args, options);
    proc.expandArgs();
    return proc.start();
};


exports.exec = function exec(cmd, options) {
    var result = exports.shell(cmd, options);
    if(result.error || result.status !== 0) {
        throw new Error("Command failed: `" + cmd + "`\n" + result.stderr.toString());
    }
    return result.stdout;
};


exports.shell = function shell(cmd, options) {
    var proc = getShellProcess(cmd, options);
    proc.stdio = "pipe";
    var result = proc.start();
    result.command = result.args[2];
    return result;
};


exports.system = function system(cmd, options) {
    var proc = getShellProcess(cmd, options);
    proc.stdio = "inherit";
    var result = proc.start();
    if(result.error || result.status !== 0) {
        throw new Error("Command failed: `" + cmd + "`\n" + result.stderr.toString());
    }
};


// ----------------------------------------
// polyfills


function ProcessSync(executable, args, options) {
    assert(helper.isArrayLike(args));
    this.executable = tools.expand(executable);
    this.args = args;
    this.initOptions(options);
}


ProcessSync.prototype.expandArgs = function() {
    var newArgs = this.args.map(function(arg) {
        return /[*{]/.test(arg) ? tools.glob(arg) : tools.expand(arg);
    });
    this.args = helper.flatten(newArgs);
};


ProcessSync.prototype.initOptions = function(opt) {
    opt = copy(opt || {});
    this.options = opt;
    this.stdio = opt.stdio;

    opt.env = merge(tools.env, opt.env);
    if(opt.cwd) {
        opt.cwd = tools.expand(opt.cwd);
    }
    this.cwd = opt.cwd;

    if(opt.stdio === undefined) {
        opt.stdio = "pipe";
    }
};


ProcessSync.prototype.start = function() {
    var result;
    if(polyfill) {
        this.setupPolyfill();
        result = polyfill.spawnSync(this.executable, this.args, this.options);
        this.readStdioFiles(result);
        this.setErrorObject(result);
    } else {
        result = child_process.spawnSync(this.executable, this.args, this.options);
    }
    return result;
};


ProcessSync.prototype.setupPolyfill = function() {
    this.initStdioPipe();
    this.args.unshift(this.executable);
};


ProcessSync.prototype.initStdioPipe = function() {
    var opt = this.options;

    if(opt.stdio === "pipe") {
        opt.stdio = ["pipe", "pipe", "pipe"];
    } else if(opt.stdio === "inherit") {
        opt.stdio = ["inherit", "inherit", "inherit"];
    } else {
        assert(opt.stdio instanceof Array);
    }

    if(opt.stdio[0] === "pipe") {
        fs.writeFileSync(stdinFile, opt.input || "");
        opt.stdio[0] = fs.openSync(stdinFile, "r");
    }
    if(opt.stdio[1] === "pipe") {
        opt.stdio[1] = fs.openSync(stdoutFile, "w");
    }
    if(opt.stdio[2] === "pipe") {
        opt.stdio[2] = fs.openSync(stderrFile, "w");
    }
};


ProcessSync.prototype.readStdioFiles = function(res) {
    var opt = this.options;
    var encoding = opt.encoding === "buffer" ? null : opt.encoding;
    res.stdout = null;
    res.stderr = null;

    if(typeof opt.stdio[0] === "number") {
        fs.closeSync(opt.stdio[0]);
    }
    if(typeof opt.stdio[1] === "number") {
        fs.closeSync(opt.stdio[1]);
        res.stdout = fs.readFileSync(stdoutFile, encoding);
    }
    if(typeof opt.stdio[2] === "number") {
        fs.closeSync(opt.stdio[2]);
        res.stderr = fs.readFileSync(stderrFile, encoding);
    }
};


ProcessSync.prototype.setErrorObject = function(res) {
    if(res._hasTimedOut) {
        res.error = createSpawnError("Timed out", constants.ETIMEDOUT);
    }

    if(res.error !== undefined || res.status !== 127) {
        return;
    }

    var stderr = res.stderr.toString();
    var match = stderr.match(/^errno: (\d+)\n/);
    if(match) {
        var message = stderr.slice(match[0].length, -1);
        res.error = createSpawnError(message, parseInt(match[1]));
        res.stdout = null;
        res.stderr = null;
    }
};


function getShellProcess(cmd, options) {
    cmd = expandCommand(cmd);
    return new ProcessSync("/bin/sh", ["-c", cmd], options);
}


function expandCommand(cmd) {
    var newCmd = helper.shellSplit(cmd).map(function(token) {
        if(token.length === 1 && token !== "*") {
            // shorthand for whitespace or delimiter
            return token;
        }
        token = tools.expand(token);
        if(token.indexOf("**") === -1) {
            return token;
        }
        return tools.glob(token).join(" ");
    });
    return newCmd.join("");
}


function createSpawnError(msg, errno) {
    var error = new Error(msg);
    error.errno = -errno;
    error.code = errorCodeMap[errno] || "";
    error.syscall = "spawnSync";
    return error;
}


function merge(obj, mixin) {
    var result = copy(obj);
    if(mixin) {
        Object.keys(mixin).forEach(function(name) {
            result[name] = mixin[name];
        });
    }
    return result;
}


function copy(obj) {
    var result = {};
    Object.keys(obj).forEach(function(name) {
        result[name] = obj[name];
    });
    return result;
}
