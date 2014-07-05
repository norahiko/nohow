"use strict";

var tools = require("./tools.js");
var helper = require("./helper.js");
var pathModule = require("path");

var isTTY = process.stdout.isTTY && process.stderr.isTTY;

var RED = "[";
var GREEN = "[";
var YELLOW = "[";
var BLUE = "[";
var WHITE = "[";
var CLOSE = "]";

if(isTTY) {
    RED = "[\x1b[31m";
    GREEN = "[\x1b[32m";
    YELLOW = "[\x1b[33m";
    BLUE = "[\x1b[34m";
    WHITE = "[";
    CLOSE = "\x1b[39m]";
}


exports.log = function log(/* arguments */) {
    if(Number(tools.env.logLevel) < 2) {
        var args = buildArgs(GREEN, "Log", arguments);
        console.error.apply(console, args);
    }
};


exports.warn = function warn(/* arguments */) {
    if(Number(tools.env.logLevel) < 3) {
        var args = buildArgs(YELLOW, "Warning", arguments);
        console.error.apply(console, args);
    }
};


exports.error = function error(/* arguments */) {
    if(Number(tools.env.logLevel) < 4) {
        var args = buildArgs(RED, "Error", arguments);
        console.error.apply(console, args);
    }
};


exports.info = function info(/* arguments */) {
    if(Number(tools.env.logLevel) < 1) {
        var args = buildArgs(BLUE, "Info", arguments);
        console.error.apply(console, args);
    }
};


exports.taskInfo = function taskInfo(taskName, msg) {
    if(Number(tools.env.logLevel) < 1 && taskName[0] !== "_" ) {
        var args = buildArgs(BLUE, "Task " + taskName, [msg]);
        console.error.apply(console, args);
    }
};


exports.trace = function trace(/* arguments */) {
    if(Number(tools.env.logLevel) < 2) {
        var err = {};
        Error.captureStackTrace(err);
        var info = helper.getTraceInfo(err.stack, 1);
        info.src = pathModule.basename(info.src);

        var msg = info.src + ":" + info.line;
        var args = buildArgs(GREEN, msg, arguments);
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
