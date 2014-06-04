'use strict';

var assert = require('assert');
var helper = require('./helper.js');


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

exports.beforeCommand = function before(taskName) {
    Task.beforeList.push(taskName);
};

exports.afterCommand = function after(taskName) {
    Task.afterList.push(taskName);
};

exports.runCommand = function(taskName) {
    var task = Task.all[taskName];
    assert(task, 'Unkown task \'' + taskName + '\'');
    if(task.async) {
        throw new Error('Cannot run async task \'' + taskName + '\'');
    }
    task.start();
};

exports.nextMode = function nextMode() {
    assert(Task.modeList.length !== 0);
    Task.mode = Task.modeList.pop();
};


exports.startAll = function startAll(taskNames) {
    Object.freeze(Task.all);
    Object.freeze(Task.beforeList);
    Object.freeze(Task.afterList);


};

exports.reset = function () {
    Task.all = Object.create(null);
    Task.beforeList = [];
    Task.afterList = [];
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

Task.all = Object.create(null);
Task.beforeList = [];
Task.afterList = [];
Task.NO_TIMEOUT = -1;
Task.modeList = ['user', 'plugin', 'builtin'];
Task.mode = Task.modeList.pop();

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
    if(this.depends.length === 0) {
        this.startNoDepends(done);
    } else {
        this.startDepends(done);
    }
};

Task.prototype.startNoDepends = function(done) {
    if(this.async) {
        this.func(function() {
            setImmediate(done);
        });
    } else {
        this.func();
        done();
    }
};

Task.prototype.startDepends = function(done) {
    var count = 0;
    var dependsSize = this.depends.length;
    var async = this.async;
    function callback() {
        count++;
        if(dependsSize === count) {
            if(async) {
                setImmediate(done);
            } else {
                done();
            }
        }
    }

    this.depends.forEach(function(taskName) {
        Task.all[taskName].start(callback);
    });
};



function TaskQueue(tasks) {

}

exports.TaskQueue = TaskQueue;
