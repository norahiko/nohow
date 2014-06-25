"use strict";

var jub = exports;

jub.version = [0, 0, 0];

// jubfile module object. initialized in command_line.js
jub.jubfile = null;
jub.jubfilePaths = null;

// JSON object of package.json. initialized in command_line.js
jub.pkg = null;

jub.tools = require("./tools.js");
jub.Task = require("./task.js").Task;
jub._main = require("./command_line.js").main;
jub.env = jub.tools.env;

jub.expandFilters = jub.tools._expandFilters;
jub.reservedEnvValues = jub.tools._reservedEnvValues;

// set alias
for(var toolName in jub.tools) {
    if(toolName[0] !== "_") {
        jub[toolName] = jub.tools[toolName];
    }
}
