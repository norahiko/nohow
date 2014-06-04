'use strict';

exports.tasks = [];
exports.beforeTasks = [];
exports.afterTasks = [];


function Task(func, type) {
    this.func = func;
    this.type = type;
}
exports.Task = Task;

exports.task = function(taskFunc) {
};

exports.asyncTask = function (taskFunc) {
};

exports.before = function before(taskFunc) {
};

exports.after = function after(taskFunc) {
};
