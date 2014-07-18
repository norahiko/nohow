var nohow = require("../lib/nohow.js");

var assert = require("chai").assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;

suite("logging:", function() {
    var env = nohow.env;

    test("trace", function() {
        var called = [];
        var write = console._stderr.write;
        try {
            console._stderr.write = function(str) {
                called.push(str);
            };
            nohow.trace("trace %s", "ok");
        } finally {
            console._stderr.write = write;
        }

        assert(/logging_test\.js/.test(called[0]));
        equal(called[1], "trace ok\n");
    });


    test("log", function() {
        var write = console._stderr.write;
        var called = [];
        var level = env.LOG_LEVEL;
        try {
            console._stderr.write = function(str) {
                if(str[0] !== "[") {
                    called.push(str);
                }
            };

            env.LOG_LEVEL = "debug";

            nohow.debug("debug");
            env.LOG_LEVEL = "info";
            nohow.debug("debug");

            nohow.info("info");
            env.LOG_LEVEL = "log";
            nohow.info("info");

            nohow.log("log");
            env.LOG_LEVEL = "warn";
            nohow.log("log");

            nohow.warn("warn");
            env.LOG_LEVEL = "error";
            nohow.warn("warn");

            nohow.error("error");
            env.LOG_LEVEL = "quiet";
            nohow.error("error");
            deepEqual(called, ["debug\n", "info\n", "log\n", "warn\n", "error\n"]);

        } finally {
            console._stderr.write = write;
            env.LOG_LEVEL = level;
        }

    });
});
