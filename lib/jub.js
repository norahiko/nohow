'use strict';

var jub = exports;
var helper = require('./helper.js');
var taskModule = require('./task.js');
jub.Task = taskModule.Task;

jub.version = [0, 0, 0];
jub.env = Object.create(process.env);
jub.jubfile = null;
jub.pkg = null;        // package.json

normalizeEnv();


function normalizeEnv() {
    if(process.env.root === undefined) {
        jub.env.root = process.cwd();
    }
    if(process.env.PWD === undefined) {
        jub.env.PWD = process.cwd();
    }
    if(process.env.TMPDIR === undefined) {
        jub.env.TMPDIR = require('os').tmpdir();
    }
    if(process.env.TMP === undefined) {
        jub.env.TMP = jub.env.TMPDIR;
    }
}


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
    jub.addCommand('pkg', jub.pkg);
}


function generateJubfileHeader() {
    var names = Object.keys(jub.commands);
    var script = 'var jub = require(\'' + __filename + '\'), ';

    var commands = [];
    names.forEach(function(name) {
        if(name[0] !== '_') {
            commands.push(name + ' = jub.commands.' + name);
        }
    });
    script += commands.join(', ') + ';';
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

    jub.commands._extendsNativeObject();
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
// command

jub.commands = require('./commands.js');
require('./shell_commands.js');
jub.commands.env = jub.env;
jub.expandFilter = jub.commands._expandFilter;
jub.reservedValue = jub.commands._reservedValue;


jub.addCommand = function addCommand(name, cmd) {
    jub.commands[name] = cmd;
};


for(var commandName in jub.commands) {
    if(commandName[0] !== '_') {
        jub[commandName] = jub.commands[commandName];
    }
}
