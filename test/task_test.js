'use strict';

Error.stackTraceLimit = 7;
var taskModule = require('../lib/task.js');
var jub = require('../lib/jub.js');

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
        jub.task('B', noop);
        jub.task('C', noop);

        var hasDone = false;
        taskA.start(function() {
            hasDone = true;
        });
        assert(hasDone);
    });


    test('async task', function(end) {
        var taskA = new Task('A', ['B', 'C'], noop);
        jub.asyncTask('B', asyncCallback);
        jub.asyncTask('C', asyncCallback);

        var called = false;
        function done(err) {
            equal(err, null);
            called = true;
        }
        taskA.start(done);
        equal(called, false);

        setImmediate(function() {
            equal(called, true);
            end();
        });
    });


    test('runOnce tool', function() {
        var count = 0;
        jub.task('A', function() {
            count++;
        });
        jub.runOnce('A');
        jub.runOnce('A');
        jub.runOnce('A');
        equal(count, 1);
    });


    test('sync error task', function() {
        var taskA = new Task('A', ['B'], function() {
            throw new Error('A');
        });
        jub.task('B', noop);
        jub.task('C', function() {
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


    test('async error task', function(end) {
        var taskA = new Task('A', ['B', 'C'], function() {
            throw new Error('A');
        });
        jub.asyncTask('B', function(done) {
            done('Error B');
        });
        jub.asyncTask('C', function(done) {
            done('Error C');
        });

        var errors = [];
        taskA.start(function(err) {
            errors.push(err);
            if(errors.length === 2) {
                deepEqual(errors, ['Error B', 'Error C']);
                end();
            }
        });
        equal(errors.length, 0);
    });


    test('catch error', function() {
        var messages = [];
        var task = new Task('A', ['B'], noop);

        jub.task('B', function() {
            throw new Error('foo');
        });

        jub.catchError('B', function(err) {
            messages.push(err.message);
            throw new Error('bar');
        });

        jub.catchError('B', function(err) {
            messages.push(err.message);
            throw new Error('baz');
        });

        task.start(function(err) {
            messages.push(err.message);
        });

        deepEqual(messages, ['foo', 'bar', 'baz']);
    });


    test('catch error async', function(end) {
        jub.asyncTask('A', ['B'], asyncCallback);
        jub.asyncTask('B', function(done) {
            done(new Error('foo'));
        });
        jub.catchError('B', noop);

        var called = false;
        Task.get('A').start(function(err) {
            called = true;
        });
        equal(called, false);

        setTimeout(function() {
            equal(called, true);
            end();
        }, 50);
    });


    test('async test timeout', function(end) {
        jub.asyncTask('A', function(done) {
            // timeout: 1
            setTimeout(done, 100);
        });

        Task.get('A').start(function(err) {
            equal(err.message, 'timeout');
            end();
        });
    });


    test('async test not timeout', function(end) {
        jub.asyncTask('A', function(done) {
            // timeout: 100
            setImmediate(done);
        });

        Task.get('A').start(function(err) {
            equal(err, null);
            end();
        });
    });


    test('detect recursive task', function() {
        jub.task('A', ['B'], noop);
        jub.task('B', ['A'], noop);

        assert.throws(function() {
            Task.validate([]);
        }, 'Recursive task');
    });


    test('detect self recursive task', function() {
        jub.task('A', ['A'], noop);

        assert.throws(function() {
            Task.validate([]);
        }, 'Recursive task');
    });
});
