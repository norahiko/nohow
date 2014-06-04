'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var helper = require('./helper.js');

var noop = function() {};

exports.addTaskCommand = function addTaskCommand(taskName, depends, taskFunc) {
    if(Task.all[taskName]) {
        throw new Error('Task \'' + taskName + '\' is deplicated');
    }

    if(taskFunc === undefined) {
        taskFunc = depends;
        depends = [];
    }
    var task = new Task(taskName, depends, taskFunc);
    Task.all[taskName] = task;
};

exports.addAsyncTaskCommand = function addAsyncTaskCommand(taskName, depends, taskFunc) {
    exports.addTaskCommand(taskName, depends, taskFunc);
    Task.all[taskName].async = true;
};

exports.beforeTaskCommand = function before(taskName) {
    Task.beforeTaskList.push(taskName);
};

exports.afterTaskCommand = function after(taskName) {
    Task.afterTaskList.push(taskName);
};

exports.runCommand = function(taskName) {
    var task = Task.get(taskName);
    if(task.async) {
        throw new Error('Cannot run async task \'' + taskName + '\'');
    }
    task.start();
};


exports.catchErrorCommand = function(taskName, listener) {
    Task.errorEvents.on(taskName, listener);
};

exports.nextMode = function nextMode() {
    assert(Task.modeList.length !== 0);
    Task.mode = Task.modeList.pop();
};

exports.startAll = function startAll(taskNames) {
    Object.freeze(Task.all);
    Object.freeze(Task.beforeTaskList);
    Object.freeze(Task.afterTaskList);


};

exports.reset = function () {
    Task.all = Object.create(null);
    Task.beforeTaskList = [];
    Task.afterTaskList = [];
    Task.errorEvents = new EventEmitter();
};


function Task(name, depends, func) {
    assert(typeof name === 'string', 'Task name must be a string');
    assert(helper.isArrayLike(depends), 'Task dependency must be a array');
    assert(typeof func === 'function', 'Task function must be a function');

    this.name = name;
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

Task.all = Object.create(null);

Task.beforeTaskList = [];

Task.afterTaskList = [];

Task.modeList = ['user', 'plugin', 'builtin'];

Task.mode = Task.modeList.pop();

Task.errorEvents = new EventEmitter();

Task.get = function(taskName) {
    var task = Task.all[taskName];
    if(task === undefined) {
        throw new Error('Unkown task \'' + taskName + '\'');
    }
    return task;
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
    var currentTask = this;
    var execute;
    if(this.async) {
        execute = function executeAsync() {
            var timeoutId;

            currentTask.func(function(error) {
                clearTimeout(timeoutId);
                error = currentTask.handleError(error);
                setImmediate(done, error);
            });

            if(currentTask.timeout !== Task.NO_TIMEOUT) {
                timeoutId = setTimeout(function() {
                    done(new Error('timeout'));
                    done = noop;
                }, currentTask.timeout);
            }
        };
    } else {
        execute = function execute() {
            var error = null;
            try {
                currentTask.func();
            } catch(e) {
                error = currentTask.handleError(e);
            }
            done(error);
        };
    }

    if(this.depends.length === 0) {
        execute();
    } else {
        var count = this.depends.length;
        var callback = function(error) {
            count--;
            if(error) {
                count = -1;
                done(error);
            } else if(count === 0) {
                execute();
            }
        };

        this.depends.forEach(function(taskName) {
            Task.get(taskName).start(callback);
        });
    }
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


function TaskQueue(tasks) {

}

exports.TaskQueue = TaskQueue;
