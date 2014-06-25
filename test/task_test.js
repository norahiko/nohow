"use strict";

Error.stackTraceLimit = 7;
var taskModule = require("../lib/task.js");
var jub = require("../lib/jub.js");

var Task = taskModule.Task;

var assert = require("chai").assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
function noop() {}
function asyncCallback(done) {
    done();
}


suite("Task:", function() {
    setup(function() {
        taskModule.reset();
    });


    test("initialize", function() {
        var task = new Task("foo", ["a", "b"], function() {
            // description: test task
            // timeout: 123sec
            "do something";
        });
        equal(task.name, "foo");
        equal(task.mode, "builtin");
        equal(task.description, "test task");
        equal(task.timeout, 123000);
    });


    test("sync task", function() {
        var taskA = new Task("A", ["B", "C"], noop);
        jub.task("B", noop);
        jub.task("C", noop);

        var hasDone = false;
        taskA.start(function() {
            hasDone = true;
        });
        assert(hasDone);
    });

    test("async task", function(end) {
        var taskA = new Task("A", [], asyncCallback);
        taskA.async = true;

        taskA.start(function(err) {
            assert(started);
            assert.isNull(err);
            end();
        });
        var started = true;
    });


    test("sync task depends async task", function(end) {
        var taskA = new Task("A", ["B"], noop);
        jub.asyncTask("B", asyncCallback);

        function done(err) {
            assert(started);
            assert.isNull(err);
            end();
        }
        taskA.start(done);
        var started = true;
    });


    test("async depends tasks run sequentially", function(end) {
        var called = [];
        var taskA = jub.task("A", ["B", "C"], noop);

        jub.asyncTask("B", function(done) {
            setImmediate(function() {
                called.push("B");
                done();
            });
        });

        jub.asyncTask("C", function(done) {
            called.push("C");
            done();
        });

        taskA.start(function(err) {
            assert.isNull(err);
            deepEqual(called, ["B", "C"]);
            end();
        });
    });


    test("run", function() {
        var called = false;
        var taskA = jub.task("A", function () {
            equal(this.first, false);
            called = true;
        });

        equal(taskA.first, true);
        jub.run("A");
        equal(taskA.first, false);
        assert(called);
    });


    test("run with callback", function() {
        var called = false;
        jub.task("A", function () {
            called = true;
        });

        jub.run("A", function() {
            assert(called);
        });
    });


    test("async run", function(end) {
        var called = false;
        jub.asyncTask("A", function (done) {
            called = true;
            done();
        });

        jub.run("A", function(err) {
            equal(err, null);
            assert(called);
            end();
        });
    });


    test("run error", function() {
        jub.task("A", function () {
            throw new Error("Error A");
        });

        assert.throws(function() {
            jub.run("A");
        });
    });


    test("run error with callback", function() {
        jub.task("A", function () {
            throw new Error("Error A");
        });

        var error;
        assert.doesNotThrow(function() {
            jub.run("A", function(err) {
                error = err;
            });
        });

        assert.instanceOf(error, Error);
    });


    test("run error with callback", function() {
        jub.task("A", function () {
            throw new Error("Error A");
        });

        var error;
        assert.doesNotThrow(function() {
            jub.run("A", function(err) {
                error = err;
            });
        });

        assert.instanceOf(error, Error);
    });


    test("run many", function() {
        var count = 0;
        jub.task("A", function() {
            count++;
        });
        jub.run("A");
        jub.run("A");
        jub.run("A");
        equal(count, 3);
    });


    test("runOnce", function() {
        var count = 0;
        jub.task("A", function() {
            count++;
        });
        jub.runOnce("A");
        jub.runOnce("A");
        jub.runOnce("A");
        equal(count, 1);
    });


    test("sync error task 1", function() {
        var taskA = new Task("A", [], function() {
            throw new Error("Error A");
        });

        taskA.start(function(err) {
            equal(err.message, "Error A");
        });
    });


    test("sync error task 2", function() {
        var taskA = new Task("A", ["B"], function() {
            throw new Error("Error A");
        });

        jub.task("B", function() {
            throw new Error("Error B");
        });

        taskA.start(function(err) {
            equal(err.message, "Error B");
        });

        taskA.start(function(err) {
            equal(err.message, "Error A");
        });

        taskA.start(function(err) {
            assert.isNull(err);
        });
    });


    test("async error task", function(end) {
        var calledA = false;
        var calledB = false;
        var calledC = false;

        var taskA = jub.asyncTask("A", ["B", "C"], function(done) {
            calledA = true;
            done("Error A");
        });

        jub.asyncTask("B", function(done) {
            calledB = true;
            done("Error B");
        });

        jub.asyncTask("C", function(done) {
            calledC = true;
            done("Error C");
        });

        var errors = [];
        taskA.start(function(err) {
            equal(err, "Error B");
            equal(calledA, false);
            equal(calledB, true);
            equal(calledC, false);
            end();
        });
        equal(errors.length, 0);
    });


    test("catch error", function() {
        var messages = [];
        var task = new Task("A", ["B"], noop);

        jub.task("B", function() {
            throw new Error("foo");
        });

        jub.catchError("B", function(err) {
            messages.push(err.message);
            throw new Error("bar");
        });

        jub.catchError("B", function(err) {
            messages.push(err.message);
            throw new Error("baz");
        });

        task.start(function(err) {
            messages.push(err.message);
        });

        deepEqual(messages, ["foo", "bar", "baz"]);
    });


    test("catch error async", function(end) {
        jub.asyncTask("A", ["B"], asyncCallback);
        jub.asyncTask("B", function(done) {
            done(new Error("foo"));
        });
        jub.catchError("B", noop);

        var started = false;
        Task.get("A").start(function(err) {
            assert(started);
            equal(err, null);
            end();
        });
        started = true;
    });


    test("async task invalid argument", function() {
        assert.throws(function () {
            jub.asyncTask("A", noop);
        }, "Async task");
    });


    test("async test timeout", function(end) {
        jub.asyncTask("A", function(done) {
            // timeout: 1
            setTimeout(done, 50);
        });

        Task.get("A").start(function(err) {
            equal(err.message, "timeout");
            end();
        });
    });


    test("async test not timeout", function(end) {
        jub.asyncTask("A", function(done) {
            // timeout: 100
            setImmediate(done);
        });

        Task.get("A").start(function(err) {
            equal(err, null);
            end();
        });
    });
});
