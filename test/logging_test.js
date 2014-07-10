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
        try {
            console.error = function() {
                called.push(arguments[1]);
            };

            env.logLevel = 1;
            nohow.log(1);

            env.logLevel = 2;
            nohow.log(2);

            env.logLevel = 1;
            nohow.log(1);

            deepEqual(called, [1, 1]);
        } finally {
            console.error = err;
            env.logLevel = 0;
        }

    });
});
