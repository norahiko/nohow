'use strict';

Error.stackTraceLimit = 7;
var taskModule = require('../lib/task.js');
var Task = taskModule.Task;

var assert = require('chai').assert;
var equal = assert.strictEqual;
//var deepEqual = assert.deepEqual;
function noop() {}
function asyncCallback(done) {
    done();
}


suite.skip('Task', function() {
    setup(function() {
        taskModule.reset();
    });

    test('initialize', function() {
        var task = new Task('foo', ['a', 'b'], function() {
            // description: test task
            // timeout: 123sec
            'do something';
        });
        equal(task.name, 'foo');
        equal(task.mode, 'builtin');
        equal(task.description, 'test task');
        equal(task.timeout, 123000);
    });

    test('sync task', function() {
        var taskA = new Task('A', ['B', 'C'], noop);
        taskModule.addTaskCommand('B', noop);
        taskModule.addTaskCommand('C', noop);

        var hasDone = false;
        taskA.start(function() {
            hasDone = true;
        });
        assert(hasDone);
    });

    test('async task', function() {
        var taskA = new Task('A', ['B', 'C'], noop);
        taskModule.addTaskCommand('B', noop);
        taskModule.addAsyncTaskCommand('C', asyncCallback);

        var isDone = false;
        function done() {
            isDone = true;
        }
        taskA.start(done);
        console.log(isDone);
        setTimeout(function() {
            console.log(isDone);
        }, 1000);

    });
});
