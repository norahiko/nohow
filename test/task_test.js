'use strict';

Error.stackTraceLimit = 7; var taskModule = require('../lib/task.js');
var Task = taskModule.Task;

var assert = require('chai').assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
function noop() {}
function asyncCallback(done) {
    done();
}


suite('Task:', function() {
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

    test('sync error task', function() {
        var taskA = new Task('A', ['B'], function() {
            throw new Error('A');
        });
        taskModule.addTaskCommand('B', noop);
        taskModule.addTaskCommand('C', function() {
            throw new Error('C');
        });

        var errorMsg = '';
        taskA.start(function(err) {
            errorMsg = err.message;
        });

        equal(errorMsg, 'A');

        taskA = new Task('A', ['B', 'C'], function() {
            throw new Error('A');
        });
        taskA.start(function(err) {
            errorMsg = err.message;
        });
        equal(errorMsg, 'C');
    });

    test('async task', function(end) {
        var taskA = new Task('A', ['B', 'C'], noop);
        taskModule.addAsyncTaskCommand('B', asyncCallback);
        taskModule.addAsyncTaskCommand('C', asyncCallback);

        var isDone = false;
        function done(err) {
            equal(err, null);
            isDone = true;
        }
        taskA.start(done);
        equal(isDone, false);

        setImmediate(function() {
            equal(isDone, true);
            end();
        });
    });

    test('catch error', function() {
        var messages = [];
        var task = new Task('A', ['B'], noop);

        taskModule.addTaskCommand('B', function() {
            throw new Error('foo');
        });

        taskModule.catchErrorCommand('B', function(err) {
            messages.push(err.message);
            throw new Error('bar');
        });

        taskModule.catchErrorCommand('B', function(err) {
            messages.push(err.message);
            throw new Error('baz');
        });

        task.start(function(err) {
            messages.push(err.message);
        });

        deepEqual(messages, ['foo', 'bar', 'baz']);
    });

    test('catch error async', function(end) {
        taskModule.addAsyncTaskCommand('A', ['B'], asyncCallback);
        taskModule.addAsyncTaskCommand('B', function(done) {
            done(new Error('foo'));
        });
        taskModule.catchErrorCommand('B', noop);

        var isDone = false;
        Task.get('A').start(function(err) {
            isDone = true;
        });
        equal(isDone, false);

        setTimeout(function() {
            equal(isDone, true);
            end();
        }, 50);
    });

    test('async test timeout', function(end) {
        taskModule.addAsyncTaskCommand('A', function(done) {
            // timeout: 1
            setTimeout(done, 100);
        });

        Task.get('A').start(function(err) {
            equal(err.message, 'timeout');
            end();
        });
    });

    test('async test not timeout', function(end) {
        taskModule.addAsyncTaskCommand('A', function(done) {
            // timeout: 100
            setImmediate(done);
        });

        Task.get('A').start(function(err) {
            equal(err, null);
            end();
        });
    });
});
