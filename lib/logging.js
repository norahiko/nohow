"use strict";

var helper = require("./helper.js");
var nohow = helper.lazylib.nohow;
var tools = helper.lazylib.tools;
var pathModule = require("path");

var isTTY = process.stdout.isTTY && process.stderr.isTTY;

var RED     = "\x1b[31m";
var GREEN   = "\x1b[32m";
var YELLOW  = "\x1b[33m";
var BLUE    = "\x1b[34m";
var MAGENTA = "\x1b[35m";
var END     = "\x1b[39m";

function genTitle(text, color) {
    if(isTTY) {
        return "[" + color + text + END + "] ";
    } else {
        return "[" + text + "] ";
    }
}

var levels = {
    debug: 4,
    info: 3,
    log: 2,
    warn: 1,
    error: 0,
};

var titles = {
    debug: genTitle("Debug", MAGENTA),
    info: genTitle("Info", BLUE),
    log: genTitle("Log", GREEN),
    warn: genTitle("Warn", YELLOW),
    error: genTitle("Error", RED),
};


Object.keys(levels).forEach(function(levelName) {
    nohow.on(levelName, function(args) {
        console._stderr.write(titles[levelName]);
        console.error.apply(console, args);
    });

    exports[levelName] = function(/* arguments */) {
        if(levels[levelName] <= levels[tools.env.LOG_LEVEL.toLowerCase()]) {
            nohow.emit(levelName, arguments);

        }
    };
});


nohow.on("logging", function(title, args) {
    title = genTitle(title, GREEN);
    console._stderr.write(title);
    console.error.apply(console, args);
});


exports.trace = function trace(/* arguments */) {
    if(levels.log <= levels[tools.env.LOG_LEVEL.toLowerCase()]) {
        var err = {};
        Error.captureStackTrace(err);
        var info = helper.getTraceInfo(err.stack, 1);
        var src = pathModule.basename(info.src);
        var title = src + ":" + info.line;
        nohow.emit("logging", title, arguments);
    }
};
