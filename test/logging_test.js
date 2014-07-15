var nohow = require("../lib/nohow.js");

var assert = require("chai").assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;

suite("logging", function() {
    var env = nohow.env;

    test("trace", function() {
        var output = [];
        var err = console.error;
        try {
            console.error = function() {
                output = arguments;
            };
            nohow.trace("ok");
        } finally {
            console.error = err;
        }

        equal(output.length, 1);
        assert(/logging_test\.js/.test(output[0]));
    });


    test("log", function() {
        var err = console.error;
        var called = [];
        var level = env.LOG_LEVEL;
        try {
            console.error = function() {
                called.push(arguments[1]);
            };

            env.LOG_LEVEL = 0;

            nohow.debug(["debug"]);
            env.LOG_LEVEL = 1;
            nohow.debug(["debug"]);

            nohow.info(["info"]);
            env.LOG_LEVEL = 2;
            nohow.info(["info"]);

            nohow.log(["log"]);
            env.LOG_LEVEL = 3;
            nohow.log(["log"]);

            nohow.warn(["warn"]);
            env.LOG_LEVEL = 4;
            nohow.warn(["warn"]);

            nohow.error(["error"]);
            env.LOG_LEVEL = 5;
            nohow.error(["error"]);
            deepEqual(called, [["debug"], ["info"], ["log"], ["warn"], ["error"]]);

        } finally {
            console.error = err;
            env.LOG_LEVEL = level;
        }

    });
});
