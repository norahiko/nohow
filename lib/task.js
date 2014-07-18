"use strict";

var helper = require("./helper.js");
var logging = helper.lazylib.logging;
var tools = helper.lazylib.tools;
var assert = require("assert");
var EventEmitter = require("events").EventEmitter;

function noop() {}
function emptyTask(done) { done && done(); }


// ----------------------------------------
// tools

tools.task = function task(taskName, depends, taskFunc) {
    // arguments.length === 1
    if(depends === undefined && taskFunc === undefined) {
        depends = [];
        taskFunc = emptyTask;

    // arguments.length === 2
    } else if(taskFunc === undefined) {
        if(typeof depends === "function") {
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


tools.asyncTask = function asyncTask(taskName, depends, taskFunc) {
    var task = tools.task(taskName, depends, taskFunc);
    task.setAsync();
    if(task.func.length !== 1) {
        throw new TypeError("Async task func must has an argument");
    }
    return task;
};


tools.before = function before(taskName) {
    Task.beforeTaskList.push(taskName);
};


tools.after = function after(taskName) {
    Task.afterTaskList.push(taskName);
};


tools.run = function run(taskName, callback) {
    resetTaskRecursive(taskName, Object.create(null));
    tools.runOnce(taskName, callback);
};


tools.runOnce = function runOnce(taskName, callback) {
    var task = Task.get(taskName);
    task.start(callback || function(err) {
        if(err) { throw err; }
    });
};

tools.catchError = function(taskName, listener) {
    Task.errorEvents.on(taskName, listener);
};


// ----------------------------------------
// exports


exports.reset = function () {
    Task.all = Object.create(null);
    Task.beforeTaskList = [];
    Task.afterTaskList = [];
    Task.errorEvents = new EventEmitter();
};


/**
 * Task class
 */

function Task(taskName, depends, func) {
    if(!(this instanceof Task)) { throw new TypeError("Constructor Task requires 'new'"); }
    assert(typeof taskName === "string", "TaskName must be a string");
    assert(depends && helper.isArrayLike(depends), "Dependency tasks must be an array");
    assert(typeof func === "function", "Task func must be a function");

    this.name = taskName;
    this.depends = depends;
    this.func = func;
    this.async = false;
    this.first = true;
    this.mode = Task.mode;
    this.description = "";
    this.timeout = Task.NO_TIMEOUT;
    this.readTaskOptions();
}


exports.Task = Task;

Task.NO_TIMEOUT = -1;

Task.USER = "user";

Task.PLUGIN = "plugin";

Task.INTERNAL = "internal";

Task.mode = Task.INTERNAL;

exports.reset();


Task.get = function(taskName) {
    var task = Task.all[taskName];
    if(task === undefined) {
        throw new Error("Unknown task '" + taskName + "'");
    }
    return task;
};


Task.getAll = function() {
    var tasks = [];
    for(var name in Task.all) {
        tasks.push(Task.all[name]);
    }
    return tasks;
};


Task.prototype.start = function(done) {
    assert(typeof done === "function");
    var runner = new TaskRunner(this);
    var depends = this.depends;
    var dependsTaskIndex = 0;

    startDependsTask();

    function startDependsTask() {
        if(dependsTaskIndex === depends.length) {
            runner.run(done);
        } else {
            Task.get(depends[dependsTaskIndex]).start(callback);
        }
    }

    function callback(error) {
        dependsTaskIndex += 1;
        if(error) {
            done(error);
        } else {
            startDependsTask();
        }
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


Task.prototype.setAsync = function() {
    this.async = true;
};


Task.prototype.readTaskOptions = function() {
    var regex = /\/\/\s*(\w+)\s*:\s*(.*)/g;
    var source = this.func.toString();
    var match = regex.exec(source);

    while(match) {
        var optKey = match[1];
        var optValue = match[2];
        if(optKey === "description" || optKey === "desc") {
            this.description = optValue;
        } else if(optKey === "timeout") {
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
        }
        match = regex.exec(source);
    }
};


/**
 * TaskRunner class
 */

function TaskRunner(task) {
    this.task = task;
}


TaskRunner.prototype.run = function(done) {
    var task = this.task;
    if(task.first === false) {
        done(null);
        return;
    }

    if(task.mode !== Task.INTERNAL) {
        logging.info("Task '" + task.name + "' start");
    }

    task.first = false;
    if(task.async) {
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
            done(new Error("timeout"));
            done = noop;
        }, task.timeout);
    }
};


function resetTaskRecursive(taskName, history) {
    if(history[taskName]) {
        return;
    }
    history[taskName] = true;
    var task = Task.get(taskName);
    task.first = true;

    task.depends.forEach(function(dep) {
        resetTaskRecursive(dep, history);
    });
}
