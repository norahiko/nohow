'use strict';

var rusk = exports;
var helper = require('./helper');
var taskModule = require('./task.js');

rusk.env = Object.create(process.env);
rusk.ruskfile = null;
rusk.pkg = null;        // package.json
normalizeEnv();

function normalizeEnv(root) {
    if(root && process.env.root === undefined) {
        rusk.env.root = root;
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

rusk._loadPlugins = function loadPlugins() {
    helper.searchPluginNames().forEach(function(name) {
        var plug = require(name);
        if(plug.init) {
            plug.init(rusk);
        }
    });
    rusk.loadPlugins = null;
};

rusk._findRuskfile = helper.findRuskfile;

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


rusk._extendsNativeObject = function() {
    if([].expandEach) {
        return;
    }

    // > ['index.html', 'style.css'].expandEach('$0:abs');
    // ['/current/dir/index.html', '/current/dir/style.css']
    Object.defineProperty(Array.prototype, 'expandEach', {
        configurable: true,
        writable: true,
        value: function expandEach(exp) {
            return this.map(function(item) {
                return rusk.expand(exp, item);
            });
        },
    });

    Object.defineProperty(String.prototype, 'save', {
        configurable: true,
        writable: true,
        value: function save(filename) {
            rusk.writeFile(filename, this);
        },
    });

    Object.defineProperty(Buffer.prototype, 'save', {
        configurable: true,
        writable: true,
        value: function save(filename) {
            rusk.writeFile(filename, this);
        },
    });
};

function generateRuskfileHeader() {
    var names = Object.keys(rusk.commands);
    var script = 'var rusk = require(\'' + __filename + '\'), ';

    var commands = names.map(function(name) {
        return name + ' = rusk.commands.' + name;
    });
    script += commands.join(', ') + ';';
    script += ' rusk.ruskfile = module.exports;';
    return script;
}

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
    rusk[name] = rusk.commands[name];
});

// ----------------------------------------
// Task

rusk.task = rusk.commands.task = taskModule.addTaskCommand;
rusk.asyncTask = rusk.commands.asyncTask = taskModule.addAsyncTaskCommand;
rusk.before = rusk.commands.before = taskModule.beforeTaskCommand;
rusk.after = rusk.commands.after = taskModule.afterTaskCommand;
rusk._startAll = taskModule.startAll;
rusk._nextMode = taskModule.nextMode;
