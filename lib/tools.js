"use strict";

var tools = exports;
tools.env = createEnv();

var helper = require("./helper.js");
require("./shell_tools.js");
var assert = require("assert");
var fs = require("fs");
var pathModule = require("path");

var lazylib = helper.lazylib;


function createEnv() {
    var env = Object.create(process.env);

    if(process.env.PWD === undefined) {
        env.PWD = process.cwd();
    }
    if(process.env.TMPDIR === undefined) {
        env.TMPDIR = require("os").tmpdir();
    }

    env.ROOT = process.cwd();

    // DEBUG: 0
    // Info : 1
    // Log  : 2
    // Warn : 3
    // Error: 4
    env.LOG_LEVEL = Number(env.LOG_LEVEL || 2);

    return env;
}


tools.addTool = function addTool(name, cmd) {
    tools[name] = cmd;
};


/**
 * logging
 */

var logging = require("./logging.js");

tools.logging = logging;

tools.debug = logging.debug;

tools.info = logging.info;

tools.log = logging.log;

tools.trace = logging.trace;

tools.warn = logging.warn;

tools.error = logging.error;


// e.g. expression = "$0", "${varName}" "$varName.attr.attr", "$varName.attr:filter1:filter2"
var expressionRegexp = /\$[\w.]+(?::\w+)*|\${[\w.]+(?::\w+)*}/g;


tools.expand = function expand(format /* ...arguments */) {
    assert(typeof format === "string", "nohow.expand: arguments[0] must be a String");

    if(format[0] === "'" || format[0] === "\"") {
        return format;
    }
    format = expandHome(format);

    if(format.indexOf("$") === -1) {
        return format;
    }
    var args = arguments;

    return format.replace(expressionRegexp, function (exp) {
        return expandExpression(exp, args);
    });
};


function expandHome(format) {
    if(format === "~" || format === "~/") {
        return tools.env.HOME;
    } else if(format[0] === "~") {
        return tools.env.HOME + pathModule.sep + format.slice(1);
    }
    return format;
}


function expandExpression(exp, args) {
    // trim "$" and "${ }"
    exp = (exp[1] === "{") ? exp.slice(2, -1) : exp.slice(1);

    // extract value and filters from expression
    var filters = exp.split(":");
    var attrs = filters[0].split(".");
    var varName = attrs[0];
    var value = getEnvValue(varName, args);
    if(value === undefined) {
        throw new Error("nohow.expand: 'env." + varName + "' is not defined");
    }

    value = expandAttributes(value, attrs, varName);
    value = applyFilters(value, filters);
    // apply filter

    if(value instanceof Array) {
        return value.join(" ");
    }
    return value.toString();
}


function getEnvValue(name, args) {
    if(tools.reservedValues[name]) {
        return tools.reservedValues[name]();
    } else if(args.hasOwnProperty(name)) {
        return args[parseInt(name) + 1];
    }
    return tools.env[name];
}


function expandAttributes(value, attrs, varName) {
    for(var i = 1; i < attrs.length; i++) {
        value = value[attrs[i]];
        if(value === undefined) {
            var errorExpr = varName + "." + attrs.slice(1, i + 1).join(".");
            throw new Error("nohow.expand: 'env." + errorExpr + "' is not defined");
        }
    }
    return value;
}

function applyFilters(value, filters) {
    for(var i = 1; i < filters.length; i++) {
        value = tools.expandFilters[filters[i]](value);
    }
    return value;
}

tools.reservedValues = {
    cwd: function() {
        return process.cwd();
    },
};


tools.expandFilters = {
    abs: pathModule.resolve,
    base: pathModule.basename,
    ext: pathModule.extname,
    dir: pathModule.dirname,
    rmext: function(path) {
        var extLength = pathModule.extname(path).length;
        return extLength ? path.slice(0, -extLength) : path;
    },
    digit1: zeroFillX(1),
    digit2: zeroFillX(2),
    digit3: zeroFillX(3),
    digit4: zeroFillX(4),
    digit5: zeroFillX(5),
    digit6: zeroFillX(6),
    digit7: zeroFillX(7),
    digit8: zeroFillX(8),
};


function zeroFillX(len) {
    var zero = "00000000".slice(0, len);
    return function(num) {
        var sign = "";
        if(num < 0) {
            num = -num;
            sign = "-";
        }
        var digit = (num | 0).toString();
        if(digit.length < len) {
            return sign + (zero + digit).slice(-len);
        }
        return sign + digit;
    };
}


tools.glob = function glob(globpattern) {
    var patterns = [];
    if(typeof globpattern === "string") {
        patterns.push(tools.expand(globpattern));
    } else {
        for(var i = 0; i < globpattern.length; i++) {
            patterns.push(tools.expand(globpattern[i]));
        }
    }

    var paths = [];
    for(i = 0; i < patterns.length; i++) {
        var ptn = patterns[i];
        if(/[[{?*]/.test(ptn)) {
            var matched = lazylib.glob.sync(ptn);
            for(var m = 0; m < matched.length; m++) {
                paths.push(matched[m]);
            }
        } else if(fs.existsSync(ptn)) {
            paths.push(ptn);
        }
    }
    return paths;
};


tools.watch = function watch(pattern, callback) {
    return new lazylib.Watcher(pattern, callback);
};


tools.StaticServer = function StaticServer(options) {
    return lazylib.StaticServer(options);
};


tools.spawn = function spawn(executable, args, options) {
    return lazylib.childProcessSync.spawn(executable, args, options);
};


tools.exec = function exec(command, options) {
    return lazylib.childProcessSync.exec(command, options);
};


tools.popen = function popen(command, options) {
    return lazylib.childProcessSync.popen(command, options);
};


tools.shell = function shell(command, options) {
    return lazylib.childProcessSync.shell(command, options);
};


tools.sh = tools.shell;
