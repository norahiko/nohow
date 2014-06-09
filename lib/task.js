'use strict';

var commands = require('./commands.js');
var helper = require('./helper.js');
var tempdir = require('./tempdir.js');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

function noop() {}
function emptyTask(done) { done && done(); }

// ----------------------------------------
// commands

/**
 * Command task
 * @param {String} taskName
 * @param {String[]=} depends
 * @param {Function=} taskFunc
 */
commands.task = function task(taskName, depends, taskFunc) {
    if(Task.all[taskName]) {
        throw new Error('Task \'' + taskName + '\' is duplicated');
    }

    // arguments.length === 1
    if(depends === undefined && taskFunc === undefined) {
        depends = [];
        taskFunc = emptyTask;

    // arguments.length === 2
    } else if(taskFunc === undefined) {
        if(typeof depends === 'function') {
            taskFunc = depends;
            depends = [];
        } else {
            taskFunc = emptyTask;
        }
    }

    var _task = new Task(taskName, depends, taskFunc);
    Task.all[taskName] = _task;
    return _task;
};

/**
 * Command asyncTask
 * @param {String} taskName
 * @param {String[]=} depends
 * @param {Function=} taskFunc
 */
commands.asyncTask = function asyncTask(taskName, depends, taskFunc) {
    var task = commands.task(taskName, depends, taskFunc);
    task.setAsync();
    return task;
};

/**
 * Command before
 * @param {String} taskName
 */
commands.before = function before(taskName) {
    Task.beforeTaskList.push(taskName);
};

/**
 * Command after
 * @param {String} taskName
 */
commands.after = function after(taskName) {
    Task.afterTaskList.push(taskName);
};

/**
 * Command run
 * @param {String} taskName
 */
commands.run = function run(taskName) {
    var task = Task.get(taskName);
    task.start(function(error) {
        if(error) { throw error; }
    });
};


/**
 * Command catchError
 * @param {String} taskName
 * @param {Function} listener
 */
commands.catchError = function(taskName, listener) {
    Task.errorEvents.on(taskName, listener);
};


// ----------------------------------------
// exports


exports.nextMode = function nextMode() {
    assert(Task.modeList.length !== 0);
    Task.mode = Task.modeList.pop();
};


/**
 * Run main tasks
 * called from bin/rusk_bin.js
 * @param {String} taskName
 * @param {Function} listener
 */
exports.runMain = function runMain(mainTasks, doneAllTasks) {
    exports.addAsyncTask('--before', Task.beforeTaskList, emptyTask);
    var main = exports.addAsyncTask('--main', ['--before'].concat(mainTasks), emptyTask);
    var after = exports.addAsyncTask('--after', Task.afterTaskList, emptyTask);

    main.start(function(mainTaskError) {
        after.start(function(afterTaskError) {
            doneAllTasks(mainTaskError, afterTaskError);
        });
    });
};

/**
 * @returns {Task[]}
 */
function getAllTasks() {
    return Object.keys(Task.all).map(Task.get);
}

exports.addBuiltinTask = function() {
    commands.task('clear-tempfile', function() {
        tempdir.clearTempfiles();
    });

    commands.task('--print-rusk-help', function() {
        console.log('Rusk: Task runner for Node.');
        console.log('Version ' + require('./rusk.js').version.join('.'));
        console.log('Usage: rusk [options] [taskName ...]');
        console.log('');
        console.log('Options:');
        console.log('    -f path, --ruskfile path                   input ruskfile path.');
        console.log('    -v     , --version                         print Rusk version.');
        console.log('    -t     , --tasks                           print tasks.');
        console.log('    -x     , --exclude plugin[,plugin...]');
        console.log();

        commands.run('--print-task-list');
    });

    commands.task('--print-task-list', function() {
        var allTasks = getAllTasks();
        var pluginTasks = allTasks.filter(function(t) { return t.mode === Task.PLUGIN; });
        var userTasks = allTasks.filter(function(t) { return t.mode === Task.USER; });

        if(pluginTasks.length !== 0) {
            console.log('Plugin tasks');
            pluginTasks.forEach(printTaskLine);
        }
        if(userTasks.length !== 0) {
            console.log('User tasks');
            userTasks.forEach(printTaskLine);
        }

        function printTaskLine(task) {
            console.log('    ' + task.name);
        }
    });

    commands.task('--save-configfiles', function() {
        tempdir.saveConfigFiles();
    });
};


exports.reset = function () {
    Task.all = Object.create(null);
    Task.beforeTaskList = [];
    Task.afterTaskList = [];
    Task.errorEvents = new EventEmitter();
};


/**
 * @constructor
 * @param {String} taskName
 * @param {String[]} depends
 * @param {Function} func
 */
function Task(taskName, depends, func) {
    assert(typeof taskName === 'string', 'TaskName must be a string');
    assert(depends && helper.isArrayLike(depends), 'Dependency tasks must be a array');
    assert(typeof func === 'function', 'Task func must be a function');
    if(Task.mode !== Task.BUILTIN && taskName.slice(2) === '--') {
        throw new Error('Invalid task name \'' + taskName + '\'');
    }

    this.name = taskName;
    this.depends = depends;
    this.func = func;
    this.async = false;
    this.mode = Task.mode;
    this.description = '';
    this.timeout = Task.NO_TIMEOUT;
    this.readTaskOptions();
}

exports.Task = Task;

Task.NO_TIMEOUT = -1;

Task.USER = 'user';

Task.PLUGIN = 'plugin';

Task.BUILTIN = 'builtin';

Task.all = Object.create(null);

Task.beforeTaskList = [];

Task.afterTaskList = [];

Task.modeList = [Task.USER, Task.PLUGIN, Task.BUILTIN];

Task.mode = Task.modeList.pop();

Task.errorEvents = new EventEmitter();


/**
 * @param {String} taskName
 * @return {Task}
 */
Task.get = function(taskName) {
    var task = Task.all[taskName];
    if(task === undefined) {
        throw new Error('Unkown task \'' + taskName + '\'');
    }
    return task;
};


Task.validate = function(mainTasks) {
    Task.detectRecursiveTask(Object.keys(Task.all), Object.create(null));
    mainTasks.forEach(function (taskName) {
        if(Task.all[taskName] === undefined) {
            throw new Error('Unkown task \'' + taskName + '\'');
        }
    });
};


Task.detectRecursiveTask = function(taskNames, stack) {
    taskNames.forEach(function(name) {
        if(stack[name]) {
            throw new Error('Recursive task was detected \'' + name + '\'');
        }
        stack[name] = true;
        Task.detectRecursiveTask(Task.get(name).depends, stack);
        stack[name] = false;
    });
};


Task.prototype.readTaskOptions = function() {
    var regex = /\/\/\s*(\w+)\s*:\s*(.*)/g;
    var source = this.func.toString();
    var match = regex.exec(source);

    while(match) {
        var optKey = match[1];
        var optValue = match[2];
        if(optKey === 'description' || optKey === 'desc') {
            this.description = optValue;
        } else if(optKey === 'timeout') {
            var timeout = parseInt(optValue);
            if(optValue.match(/^\dmin/)) {
                // timeout: minutes
                this.timeout = timeout * 1000 * 60;
            } else if(optValue.match(/^\d+sec/)) {
                // timeout: seconds
                this.timeout = timeout * 1000;
            } else {
                // timeout: milliseconds
                this.timeout = timeout;
            }
        } else {
            throw new Error('Unkown task option \'' + optKey + '\'');
        }
        match = regex.exec(source);
    }
};


Task.prototype.setAsync = function() {
    this.async = true;
};


Task.prototype.start = function(done) {
    assert(typeof done === 'function');
    var runner = new TaskRunner(this, done);
    var count = this.depends.length + 1;
    callback(null);

    function callback(error) {
        count--;
        if(error) {
            count = -1; // disable this callback
            done(error);
        } else if(count === 0) {
            runner.run(done);
        }
    }

    this.depends.forEach(function(taskName) {
        Task.get(taskName).start(callback);
    });
};


Task.prototype.handleError = function(error) {
    if(error === undefined || error === null) {
        return null;
    }

    var listeners = Task.errorEvents.listeners(this.name);
    for(var i = 0; i < listeners.length; i++) {
        try {
            listeners[i](error);
            error = null;
            break;
        } catch(e) {
            error = e;
        }
    }
    return error;
};


/**
 * @constructor
 * @param {Task} task
 */
function TaskRunner(task) {
    this.task = task;
}


TaskRunner.prototype.run = function(done) {
    if(this.task.async) {
        this.runAsync(done);
    } else {
        this.runSync(done);
    }
};


TaskRunner.prototype.runSync = function(done) {
    var error = null;
    try {
        this.task.func();
    } catch(e) {
        error = this.task.handleError(e);
    }
    done(error);
};


TaskRunner.prototype.runAsync = function (done) {
    var task = this.task;
    var timeoutId;

    try {
        task.func(function(error) {
            clearTimeout(timeoutId);
            error = task.handleError(error);
            setImmediate(done, error);
        });
    } catch(error) {
        setImmediate(done, task.handleError(error));
    }

    if(task.timeout !== Task.NO_TIMEOUT) {
        timeoutId = setTimeout(function() {
            done(new Error('timeout'));
            done = noop;
        }, task.timeout);
    }
};
