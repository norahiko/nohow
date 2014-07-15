"use strict";

Error.stackTraceLimit = 7;
var nohow = require("../lib/nohow.js");
var taskModule = require("../lib/task.js");

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
        nohow.env.LOG_LEVEL = 2; // LOG_LEVEL == Log
        taskModule.reset();
    });

    teardown(function () {
        nohow.env.LOG_LEVEL = 1; // LOG_LEVEL == Info
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
        nohow.task("B", noop);
        nohow.task("C", noop);

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
        nohow.asyncTask("B", asyncCallback);

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
        var taskA = nohow.task("A", ["B", "C"], noop);

        nohow.asyncTask("B", function(done) {
            setImmediate(function() {
                called.push("B");
                done();
            });
        });

        nohow.asyncTask("C", function(done) {
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
        var taskA = nohow.task("A", function () {
            equal(this.first, false);
            called = true;
        });

        equal(taskA.first, true);
        nohow.run("A");
        equal(taskA.first, false);
        assert(called);
    });


    test("run with callback", function() {
        var called = false;
        nohow.task("A", function () {
            called = true;
        });

        nohow.run("A", function() {
            assert(called);
        });
    });


    test("async run", function(end) {
        var called = false;
        nohow.asyncTask("A", function (done) {
            called = true;
            done();
        });

        nohow.run("A", function(err) {
            equal(err, null);
            assert(called);
            end();
        });
    });


    test("run error", function() {
        nohow.task("A", function () {
            throw new Error("Error A");
        });

        assert.throws(function() {
            nohow.run("A");
        });
    });


    test("run error with callback", function() {
        nohow.task("A", function () {
            throw new Error("Error A");
        });

        var error;
        assert.doesNotThrow(function() {
            nohow.run("A", function(err) {
                error = err;
            });
        });

        assert.instanceOf(error, Error);
    });


    test("run error with callback", function() {
        nohow.task("A", function () {
            throw new Error("Error A");
        });

        var error;
        assert.doesNotThrow(function() {
            nohow.run("A", function(err) {
                error = err;
            });
        });

        assert.instanceOf(error, Error);
    });


    test("run many", function() {
        var count = 0;
        nohow.task("A", function() {
            count++;
        });
        nohow.run("A");
        nohow.run("A");
        nohow.run("A");
        equal(count, 3);
    });


    test("runOnce", function() {
        var count = 0;
        nohow.task("A", function() {
            count++;
        });
        nohow.runOnce("A");
        nohow.runOnce("A");
        nohow.runOnce("A");
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

        nohow.task("B", function() {
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

        var taskA = nohow.asyncTask("A", ["B", "C"], function(done) {
            calledA = true;
            done("Error A");
        });

        nohow.asyncTask("B", function(done) {
            calledB = true;
            done("Error B");
        });

        nohow.asyncTask("C", function(done) {
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

        nohow.task("B", function() {
            throw new Error("foo");
        });

        nohow.catchError("B", function(err) {
            messages.push(err.message);
            throw new Error("bar");
        });

        nohow.catchError("B", function(err) {
            messages.push(err.message);
            throw new Error("baz");
        });

        task.start(function(err) {
            messages.push(err.message);
        });

        deepEqual(messages, ["foo", "bar", "baz"]);
    });


    test("catch error async", function(end) {
        nohow.asyncTask("A", ["B"], asyncCallback);
        nohow.asyncTask("B", function(done) {
            done(new Error("foo"));
        });
        nohow.catchError("B", noop);

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
            nohow.asyncTask("A", noop);
        }, "Async task");
    });


    test("async test timeout", function(end) {
        nohow.asyncTask("A", function(done) {
            // timeout: 1
            setTimeout(done, 50);
        });

        Task.get("A").start(function(err) {
            equal(err.message, "timeout");
            end();
        });
    });


    test("async test not timeout", function(end) {
        nohow.asyncTask("A", function(done) {
            // timeout: 100
            setImmediate(done);
        });

        Task.get("A").start(function(err) {
            equal(err, null);
            end();
        });
    });
});
