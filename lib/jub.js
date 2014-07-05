"use strict";

var jub = exports;
var tools = require("./tools.js");
Object.defineProperty(jub, "tools", { value: tools });

jub.version = [0, 0, 0];

// jubfile module object. initialized in command_line.js
jub.jubfile = null;
jub.jubfilePaths = null;

// JSON object of package.json. initialized in command_line.js
jub.pkg = null;

jub.Task = require("./task.js").Task;
jub._main = require("./command_line.js").main;

// set alias
for(var name in jub.tools) {
    if(name[0] !== "_") {
        jub[name] = jub.tools[name];
    }
}
