'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var helper = require('./helper.js');

function noop() {}
function emptyTask(done) { done && done(); }

// ----------------------------------------
// exports

/**
 * Command task
 * @param {String} taskName
 * @param {String[]=} depends
 * @param {Function=} taskFunc
 */
exports.addTask = function addTask(taskName, depends, taskFunc) {
    if(Task.all[taskName]) {
        throw new Error('Task \'' + taskName + '\' is deplicated');
    }

    if(typeof depends === 'function') {
        taskFunc = depends;
        depends = [];
    }
    var task = new Task(taskName, depends, taskFunc);
    Task.all[taskName] = task;
};

/**
 * Command asyncTask
 * @param {String} taskName
 * @param {String[]=} depends
 * @param {Function=} taskFunc
 */
exports.addAsyncTask = function addAsyncTask(taskName, depends, taskFunc) {
    exports.addTask(taskName, depends, taskFunc);
    Task.all[taskName].async = true;
};

/**
 * Command before
 * @param {String} taskName
 */
exports.beforeTask = function before(taskName) {
    Task.beforeTaskList.push(taskName);
};

/**
 * Command after
 * @param {String} taskName
 */
exports.afterTask = function after(taskName) {
    Task.afterTaskList.push(taskName);
};

/**
 * Command run
 * @param {String} taskName
 */
exports.run = function run(taskName) {
    var task = Task.get(taskName);
    if(task.async) {
        throw new Error('Cannot run async task \'' + taskName + '\'');
    }
    task.start(function(error) {
        if(error) { throw error; }
    });
};


/**
 * Command catchError
 * @param {String} taskName
 * @param {Function} listener
 */
exports.catchError = function(taskName, listener) {
    Task.errorEvents.on(taskName, listener);
};

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
exports.runRootTask = function runRootTask(mainTasks, doneAllTasks) {
    var mainTaskError = null;
    exports.addTask('--before', Task.beforeTaskList);
    exports.addTask('--main', ['--before'].concat(mainTasks));
    exports.addTask('--after', Task.afterTaskList);
    exports.addAsyncTask('--root', ['--main', '--after']);
    exports.catchError('--main', function(e) {
        mainTaskError = e;
    });

    Object.freeze(Task.all);
    Object.freeze(Task.beforeTaskList);
    Object.freeze(Task.afterTaskList);
    Object.freeze(Task.errorEvents);

    var rootTask = Task.get('--root');
    rootTask.start(function(afterTaskError) {
        doneAllTasks(mainTaskError, afterTaskError);
    });
};

/**
 * @returns {Task[]}
 */
exports.getAllTasks = function() {
    return Object.keys(Task.all).map(Task.get);
};

exports.addBuiltinTask = function() {
    exports.addTask('clear-tempfile', function() {
        require('./tempdir.js').clearTempfile();
    });

    exports.addTask('print-rusk-help', function() {
        console.log('Rusk: Task runner for Node.');
        console.log('Version ' + require('./rusk.js').version.join('.'));
        console.log('Usage: rusk [options] [taskName ...]');
        console.log('');
        console.log('Options:');
        console.log('    -f path, --ruskfile path         input ruskfile path.');
        console.log('    -v     , --version               print Rusk version.');
        console.log('    -t     , --tasks                 print tasks.');
        console.log('    --exclude plugin[,plugin...]');
        console.log();

        exports.run('print-task-list');
    });

    exports.addTask('print-task-list', function() {
        var allTasks = exports.getAllTasks();
        var pluginTasks = allTasks.filter(function(t) { return t.mode === 'plugin' });
        var userTasks = allTasks.filter(function(t) { return t.mode === Task.USER});

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
    assert(typeof taskName === 'string', 'Task taskName must be a string');
    assert(helper.isArrayLike(depends), 'Task dependency must be a array');

    this.name = taskName;
    this.depends = depends;
    this.func = func || emptyTask;
    this.async = false;
    this.mode = Task.mode;
    this.description = '';
    this.timeout = Task.NO_TIMEOUT;
    this.readTaskOptions();
}

exports.Task = Task;

Task.NO_TIMEOUT = -1;

Task.all = Object.create(null);

Task.beforeTaskList = [];

Task.afterTaskList = [];

Task.USER = 'user';
Task.PLUGIN = 'plugin';
Task.BUILTIN = 'builtin';
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

Task.validate = function() {
    Task.checkRecursiveTask(Object.keys(Task.all), Object.create(null));
};


Task.checkRecursiveTask = function(taskNames, stack) {
    taskNames.forEach(function(name) {
        if(stack[name]) {
            throw new Error('Recursive task \'' + name + '\' is not available');
        }
        stack[name] = true;
        Task.checkRecursiveTask(Task.get(name).depends, stack);
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
        if(optKey === 'description') {
            this.description = optValue;
        } else if(optKey === 'timeout') {
            var timeout = parseInt(optValue);
            if(optValue.match(/^\dmin/)) {
                // timeout: 100min
                this.timeout = timeout * 1000 * 60;
            } else if(optValue.match(/^\d+sec/)) {
                // timeout: 100sec
                this.timeout = timeout * 1000;
            } else {
                // timeout: 1000000
                this.timeout = timeout;
            }
        } else {
            throw new Error('Unkown task option \'' + optKey + '\'');
        }
        match = regex.exec(source);
    }
};

Task.prototype.start = function(done) {
    var taskExec = new TaskExec(this, done);
    var count = this.depends.length + 1;
    callback(null);

    function callback(error) {
        count--;
        if(error) {
            count = -1; // disable this callback
            done(error);
        } else if(count === 0) {
            taskExec.execute(done);
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


// ----------------------------------------
// TaskExec

function TaskExec(task) {
    this.task = task;
}

TaskExec.prototype.execute = function(done) {
    if(this.task.async) {
        this.async(done);
    } else {
        this.sync(done);
    }
};

TaskExec.prototype.sync = function(done) {
    var error = null;
    try {
        this.task.func();
    } catch(e) {
        error = this.task.handleError(e);
    }
    done(error);
};

TaskExec.prototype.async = function (done) {
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
