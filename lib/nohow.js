"use strict";

var nohow = exports;
var tools = require("./tools.js");
Object.defineProperty(nohow, "tools", { value: tools });

nohow.version = [0, 0, 0];

// nohow module object. initialized in command_line.js
nohow.nohowFile = null;
nohow.nohowFilePaths = null;

// JSON object of package.json. initialized in command_line.js
nohow.pkg = null;

nohow.Task = require("./task.js").Task;
nohow._main = require("./command_line.js").main;

// set alias
for(var name in nohow.tools) {
    if(name[0] !== "_") {
        nohow[name] = nohow.tools[name];
    }
}
