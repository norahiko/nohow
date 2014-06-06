'use strict';

var rusk = exports;
var helper = require('./helper');
var taskModule = require('./task.js');

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


rusk._loadPlugins = function loadPlugins(excludePlugins) {
    helper.searchPluginNames().forEach(function(name) {
        if(excludePlugins.indexOf(name) === -1) {
            require(name);
        }
    });
    rusk.loadPlugins = null;
};

rusk._findRuskfile = helper.findRuskfile;

rusk._printHelp = helper.printHelp;


rusk._loadRuskfile = function loadRuskFile(filename) {
    if(rusk.ruskfile) {
        return rusk.ruskfile;
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
    return rusk.ruskfile;
};


rusk._loadPackageJSON = function(filename) {
    if(rusk.pkg) {
        return rusk.pkg;
    }
    rusk.pkg = helper.loadJSON(filename);
    rusk.addCommand('pkg', rusk.pkg);
    return rusk.pkg;
};


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
    if(options.ruskfilePath === undefined) {
        options.ruskfilePath = rusk._findRuskfile() || null;
    }
    if(options.versionFlag) {
        console.log(rusk.version.join('.'));
        return;
    }

    taskModule.addBuiltinTask();
    rusk.after('--save-configfiles');
    taskModule.nextMode(); // taskmode: builtin -> plugin
    rusk.commands._extendsNativeObject();
    rusk._loadPlugins(options.excludePlugins);
    taskModule.nextMode(); // taskmode: plugin -> user

    if(options.ruskfilePath) {
        rusk._loadRuskfile(options.ruskfilePath);
    }
    if(options.taskListFlag) {
        rusk.run('--print-task-list');
        return;
    }
    if(options.helpFlag) {
        rusk.run('--print-rusk-help');
        return;
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

// ----------------------------------------
// Task

rusk.task = rusk.commands.task = taskModule.addTask;
rusk.asyncTask = rusk.commands.asyncTask = taskModule.addAsyncTask;
rusk.before = rusk.commands.before = taskModule.beforeTask;
rusk.after = rusk.commands.after = taskModule.afterTask;
rusk.run = rusk.commands.run = taskModule.run;
rusk.catchError = rusk.commands.catchError = taskModule.catchError;
