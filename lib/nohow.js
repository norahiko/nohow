"use strict";

var nohow = exports;
nohow.version = [0, 0, 0];

var helper = require("./helper.js");
var lazylib = helper.lazylib;
helper.wrapEventEmitter(nohow);

var tools = lazylib.tools;
Object.defineProperty(nohow, "tools", { value: tools });

// nohow module object. initialized in command_line.js
nohow.nohowFile = null;
nohow.nohowFilePaths = null;

// JSON object of package.json. initialized in command_line.js
nohow.pkg = null;

nohow.Task = lazylib.taskModule.Task;
nohow._main = lazylib.commandLine.main;

// set alias
for(var name in tools) {
    if(name[0] !== "_") {
        nohow[name] = tools[name];
    }
}
