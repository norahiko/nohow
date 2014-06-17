'use strict';

var jub = exports;
var helper = require('./helper.js');
var taskModule = require('./task.js');
jub.Task = taskModule.Task;

jub.version = [0, 0, 0];
jub.jubfile = null;
jub.pkg = null;        // package.json


function loadPlugins(excludePlugins) {
    helper.searchPluginNames().forEach(function(name) {
        if(excludePlugins.indexOf(name) === -1) {
            require(name);
        }
    });
}


function loadJubfile() {
    var filename = jub.jubfilePaths.pop();
    if(! filename) {
        jub.jubfile = null;
        return;
    }
    var header = generateJubfileHeader();
    var Module = require('module');
    var _wrap = Module.wrap;
    Module.wrap = function(script) {
        Module.wrap = _wrap;
        return _wrap(header + script);
    };

    try {
        jub.jubfile = require(filename);
    } finally {
        Module.wrap = _wrap;
    }
}


function loadPackageJson(filename) {
    try {
        jub.pkg = helper.loadJSON(filename);
    } catch(_) {
        // Not found package.json or Syntax Error
    }
    jub.addtool('pkg', jub.pkg);
}


function generateJubfileHeader() {
    var names = Object.keys(jub.tools);
    var script = 'var jub = require(\'' + __filename + '\'), ';

    var tools = [];
    names.forEach(function(name) {
        if(name[0] !== '_') {
            tools.push(name + ' = jub.tools.' + name);
        }
    });
    script += tools.join(', ') + ';';
    script += ' jub.jubfile = module.exports;';
    return script;
}


jub._main = function() {
    var options = helper.parseArgs(process.argv.slice(2));
    if(options.versionFlag) {
        console.log(jub.version.join('.'));
        return;
    }

    if(options.jubfilePath) {
        jub.jubfilePaths = [options.jubfilePath];
    } else {
        jub.jubfilePaths = helper.findJubfiles();
    }

    taskModule.addBuiltinTask();
    jub.after('--save-configfiles');
    taskModule.nextMode(); // taskmode: builtin -> plugin

    jub.tools._extendsNativeObject();
    loadPlugins(options.excludePlugins);
    taskModule.nextMode(); // taskmode: plugin -> user

    loadPackageJson();

    loadJubfile();

    if(options.taskListFlag) {
        jub.run('--print-task-list');
        return;
    }

    if(options.helpFlag) {
        jub.run('--print-jub-help');
        return;
    }

    try {
        taskModule.Task.validate(options.tasks);
    } catch(error) {
        console.error(error);
        process.exit(1);
    }

    taskModule.runMain(options.tasks, function(mainError, afterTaskError) {
        if(mainError) {
            console.error(mainError.stack);
        }
        if(afterTaskError) {
            console.error(afterTaskError.stack);
        }
        if(mainError || afterTaskError) {
            process.exit(8);
        }
    });
};


// ----------------------------------------
// tool

jub.tools = require('./tools.js');
require('./shell_tools.js');
jub.env = jub.tools.env;
jub.expandFilter = jub.tools._expandFilter;
jub.reservedValue = jub.tools._reservedValue;


jub.addTool = function addTool(name, cmd) {
    jub.tools[name] = cmd;
};


for(var toolName in jub.tools) {
    if(toolName[0] !== '_') {
        jub[toolName] = jub.tools[toolName];
    }
}
