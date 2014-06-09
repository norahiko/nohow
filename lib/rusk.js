'use strict';

var rusk = exports;
var helper = require('./helper.js');
var taskModule = require('./task.js');
rusk.Task = taskModule.Task;

rusk.version = [0, 0, 0];
rusk.env = Object.create(process.env);
rusk.ruskfile = null;
rusk.pkg = null;        // package.json

normalizeEnv();

function normalizeEnv() {
    if(process.env.root === undefined) {
        rusk.env.root = process.cwd();
    }
    if(process.env.PWD === undefined) {
        rusk.env.PWD = process.cwd();
    }
    if(process.env.TMPDIR === undefined) {
        rusk.env.TMPDIR = require('os').tmpdir();
    }
    if(process.env.TMP === undefined) {
        rusk.env.TMP = rusk.env.TMPDIR;
    }
}


function loadPlugins(excludePlugins) {
    helper.searchPluginNames().forEach(function(name) {
        if(excludePlugins.indexOf(name) === -1) {
            require(name);
        }
    });
}


function loadRuskfile() {
    var filename = rusk.ruskfilePaths.pop();
    if(! filename) {
        rusk.ruskfile = null;
        return;
    }
    var header = generateRuskfileHeader();
    var Module = require('module');
    var _wrap = Module.wrap;
    Module.wrap = function(script) {
        Module.wrap = _wrap;
        return _wrap(header + script);
    };

    try {
        rusk.ruskfile = require(filename);
    } finally {
        Module.wrap = _wrap;
    }
}


function loadPackageJson(filename) {
    try {
        rusk.pkg = helper.loadJSON(filename);
    } catch(_) {
        // Not found package.json or Syntax Error
    }
    rusk.addCommand('pkg', rusk.pkg);
}


function generateRuskfileHeader() {
    var names = Object.keys(rusk.commands);
    var script = 'var rusk = require(\'' + __filename + '\'), ';

    var commands = [];
    names.forEach(function(name) {
        if(name[0] !== '_') {
            commands.push(name + ' = rusk.commands.' + name);
        }
    });
    script += commands.join(', ') + ';';
    script += ' rusk.ruskfile = module.exports;';
    return script;
}


rusk._main = function() {
    var options = helper.parseArgs(process.argv.slice(2));
    if(options.versionFlag) {
        console.log(rusk.version.join('.'));
        return;
    }

    if(options.ruskfilePath) {
        rusk.ruskfilePaths = [options.ruskfilePath];
    } else {
        rusk.ruskfilePaths = helper.findRuskfiles();
    }

    taskModule.addBuiltinTask();
    rusk.after('--save-configfiles');
    taskModule.nextMode(); // taskmode: builtin -> plugin

    rusk.commands._extendsNativeObject();
    loadPlugins(options.excludePlugins);
    taskModule.nextMode(); // taskmode: plugin -> user

    loadPackageJson();

    loadRuskfile();

    if(options.taskListFlag) {
        rusk.run('--print-task-list');
        return;
    }

    if(options.helpFlag) {
        rusk.run('--print-rusk-help');
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
// command

rusk.commands = require('./commands.js');
rusk.commands.env = rusk.env;
require('./shell_commands.js');
rusk.expandFilter = rusk.commands.expandFilter;
rusk.reservedValue = rusk.commands.reservedValue;


rusk.addCommand = function addCommand(name, cmd) {
    rusk.commands[name] = cmd;
};


Object.keys(rusk.commands).forEach(function(name) {
    if(name[0] !== '_') {
        rusk[name] = rusk.commands[name];
    }
});
