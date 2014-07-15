"use strict";

var tools = require("./tools.js");
var helper = require("./helper.js");
var pathModule = require("path");

var isTTY = process.stdout.isTTY && process.stderr.isTTY;

var DEBUG = 0;
var INFO = 1;
var LOG = 2;
var WARN = 3;
var ERROR = 4;

var RED = "[";
var GREEN = "[";
var YELLOW = "[";
var BLUE = "[";
var MAGENTA = "[";
var WHITE = "[";
var CLOSE = "]";

if(isTTY) {
    RED = "[\x1b[31m";
    GREEN = "[\x1b[32m";
    YELLOW = "[\x1b[33m";
    BLUE = "[\x1b[34m";
    MAGENTA = "[\x1b[35m";
    WHITE = "[";
    CLOSE = "\x1b[39m]";
}


exports.debug = function debug(/* arguments */) {
    if(tools.env.LOG_LEVEL <= DEBUG) {
        var args = buildArgs(MAGENTA, "Debug", arguments);
        console.error.apply(console, args);
    }
};


exports.info = function info(/* arguments */) {
    if(tools.env.LOG_LEVEL <= INFO) {
        var args = buildArgs(BLUE, "Info", arguments);
        console.error.apply(console, args);
    }
};


exports.taskInfo = function taskInfo(taskName, msg) {
    if(tools.env.LOG_LEVEL <= INFO) {
        var args = buildArgs(BLUE, "Task " + taskName, [msg]);
        console.error.apply(console, args);
    }
};


exports.trace = function trace(/* arguments */) {
    if(tools.env.LOG_LEVEL <= LOG) {
        var err = {};
        Error.captureStackTrace(err);
        var info = helper.getTraceInfo(err.stack, 1);
        info.src = pathModule.basename(info.src);

        var msg = info.src + ":" + info.line;
        var args = buildArgs(GREEN, msg, arguments);
        console.error.apply(console, args);
    }
};


exports.log = function log(/* arguments */) {
    if(tools.env.LOG_LEVEL <= LOG) {
        var args = buildArgs(GREEN, "Log", arguments);
        console.error.apply(console, args);
    }
};


exports.warn = function warn(/* arguments */) {
    if(tools.env.LOG_LEVEL <= WARN) {
        var args = buildArgs(YELLOW, "Warning", arguments);
        console.error.apply(console, args);
    }
};


exports.error = function error(/* arguments */) {
    if(tools.env.LOG_LEVEL <= ERROR) {
        var args = buildArgs(RED, "Error", arguments);
        console.error.apply(console, args);
    }
};


function buildArgs(color, title, args) {
    title = color + title + CLOSE;
    args = Array.prototype.slice.call(args, 0);

    if(typeof args[0] === "string") {
        args[0] = title + " " + args[0];
    } else {
        args.unshift(title);
    }

    return args.map(function(arg) {
        if(typeof arg === "string") {
            return tools.expand(arg);
        }
        return arg;
    });
}
