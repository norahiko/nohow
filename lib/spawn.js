'use strict';

var helper = require('./helper.js');
var tools = require('./tools.js');
var child_process = require('child_process');
var fs = require('fs');

var polyfill = null;
var stdinFile, stdoutFile, stderrFile;

if(child_process.spawnSync === undefined) {
    try {
        polyfill = require('../build/Release/polyfill.node');
    } catch(_) {
        polyfill = require('../build/Debug/polyfill.node');
    }
    stdinFile = tools.tempfile();
    stdoutFile = tools.tempfile();
    stderrFile = tools.tempfile();
}

// ----------------------------------------
// exports

exports.spawn = function spawn(executable, args, options) {
    if(Array.isArray(args) === false) {
        options = args;
        args = [];
    }

    executable = tools.expand(executable);
    args = args.map(tools.expand);
    options = normalizeOptions(options);
    if(options.stdio !== 'inherit') {
        options.stdio = 'pipe';
    }
    return callSpawn(executable, args, options);
};


exports.exec = function exec(cmd, options) {
    var result = callExec(cmd, 'pipe', options);
    if(result.status !== 0) {
        throw new Error('Command failed: `' + cmd + '`\n' + result.stderr.toString());
    }
    return result.stdout;
};


exports.shell = function shell(cmd, options) {
    return callExec(cmd, 'pipe', options);
};


exports.system = function system(cmd, options) {
    var result = callExec(cmd, 'inherit', options);
    return result.status === 0;
};


// ----------------------------------------
// polyfills

function callExec(cmd, stdio, options) {
    cmd = expandCommand(cmd);
    options = normalizeOptions(options);
    options.stdio = stdio;
    return callSpawn('/bin/sh', ['-c', cmd], options);
}


function callSpawn(executable, args, options) {
    var result;
    if(polyfill === null) {
        result = child_process.spawnSync(executable, args, options);
    } else {
        initStdioFiles(options);
        args.unshift(executable);
        result = polyfill.spawnSync(executable, args, options);
        readStdioFiles(result, options);
        setErrorObject(result);

    }
    normalizeResult(result);
    return result;
}


function normalizeOptions(opt) {
    var options = copy(opt || {});
    options.env = merge(tools.env, options.env);
    options.cwd = options.cwd ? tools.expand(options.cwd) : null;
    return options;
}


function initStdioFiles(options) {
    options.stdinFd = -1;
    options.stdoutFd = -1;
    options.stderrFd = -1;
    if(options.stdio === 'pipe') {
        fs.writeFileSync(stdinFile, options.input || '');
        options.stdinFd = fs.openSync(stdinFile, 'r');
        options.stdoutFd = fs.openSync(stdoutFile, 'w');
        options.stderrFd = fs.openSync(stderrFile, 'w');
    }
}


function readStdioFiles(result, options) {
    if(options.stdio === 'pipe') {
        fs.closeSync(options.stdoutFd);
        fs.closeSync(options.stderrFd);
        result.stdout = fs.readFileSync(stdoutFile);
        result.stderr = fs.readFileSync(stderrFile);
        if(options.encoding && options.encoding !== 'buffer') {
            result.stdout = result.stdout.toString(options.encoding);
            result.stderr = result.stderr.toString(options.encoding);
        }
    } else {
        result.stdout = null;
        result.stdin = null;
    }
}


function expandCommand(cmd) {
    var cmd_ = helper.shellSplit(cmd).map(function(token) {
        if(token.length === 1 && token !== '*') {
            // shorthand for whitespace or delimiter
            return token;
        }
        token = tools.expand(token);
        if(token.indexOf('**') === -1) {
            return token;
        }
        return tools.glob(token).join(' ');
    });
    return cmd_.join('');
}


function setErrorObject(result) {
    if(result.error === undefined && result.status === 127) {
        result.error = new Error(result.stderr.toString().replace(/\n+$/, ''));
    }
}


function normalizeResult(result) {
    if(result.error) {
        result.status = 127;
    }
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
