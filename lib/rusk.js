'use strict';

var rusk = exports;
var helper = require('./helper');
//var task = require('./task');

rusk.env = Object.create(process.env);
rusk.tasks = {};
rusk.commands = { env: rusk.env };
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

rusk.loadPlugins = function loadPlugins() {
    helper.searchPluginNames().forEach(function(name) {
        var plug = require(name);
        if(plug.init) {
            plug.init(rusk);
        }
    });
    rusk.loadPlugins = null;
};

rusk.findRuskfile = helper.findRuskfile;

rusk.loadRuskfile = function loadRuskFile(filename) {
    if(rusk.ruskfile) {
        return rusk.ruskfile;
    }
    var header = rusk.generateRuskfileHeader();
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

rusk.loadPackageJSON = function(filename) {
    if(rusk.pkg) {
        return rusk.pkg;
    }
    rusk.pkg = helper.loadJSON(filename);
    rusk.addCommand('pkg', rusk.pkg);
    return rusk.pkg;
};

rusk.generateRuskfileHeader = function generateRuskfileHeader() {
    var names = Object.keys(rusk.commands);
    var script = 'var rusk = require(\'' + __filename + '\'), ';
    var commands = names.map(function(name) {
        return name + ' = rusk.commands.' + name;
    });
    script += commands.join(', ') + ';';
    return script;
};

rusk.extendsNativeObject = function() {
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

// ----------------------------------------
// command
var builtins = require('./builtin_command.js');

rusk.addCommand = function addCommand(name, cmd) {
    rusk.commands[name] = cmd;
};

function addBuiltin(name, command) {
    rusk.addCommand(name, command);
    rusk[name] = command;
}


addBuiltin('trace', builtins.trace);
addBuiltin('expand', builtins.expand);
addBuiltin('glob',   builtins.glob);
addBuiltin('ls', builtins.ls);
addBuiltin('root', builtins.root);
addBuiltin('cwd', builtins.cwd);
addBuiltin('chdir', builtins.chdir);
addBuiltin('cd', builtins.chdir);       // alias
addBuiltin('pushd', builtins.pushd);
addBuiltin('popd', builtins.popd);
addBuiltin('exists', builtins.exists);
addBuiltin('notExists', builtins.notExists);
addBuiltin('mkdir', builtins.mkdir);
addBuiltin('move', builtins.move);
addBuiltin('copy', builtins.copy);
addBuiltin('cp', builtins.copy);        // alias
addBuiltin('remove', builtins.remove);
addBuiltin('rm', builtins.remove);      // alias
addBuiltin('removeRecursive', builtins.removeRecursive);
addBuiltin('writeFile', builtins.writeFile);
addBuiltin('readFile', builtins.readFile);
addBuiltin('readFileBuffer', builtins.readFileBuffer);
addBuiltin('concat', builtins.concat);
addBuiltin('concatBuffer', builtins.concatBuffer);
addBuiltin('replace', builtins.replace);
addBuiltin('edit', builtins.edit);
addBuiltin('tempfile', builtins.tempfile);


rusk.foo = 'foo';

rusk.expandFilter = builtins.expandFilter;
rusk.reservedValue = builtins.reservedValue;


// ----------------------------------------
// Task

//var _task = require('./task.js');
//var Task = _task.Task;

//rusk.addTask = function addTask(name, func) {
    

//};


