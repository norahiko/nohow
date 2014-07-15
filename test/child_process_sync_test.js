"use strict";

var nohow = require("../lib/nohow.js");
var chai = require("chai");
var assert = chai.assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
var env = nohow.env;
env.TMPDIR = ".";

suite("Child process sync:", function() {
    // skip tests if polyfill wasn't compiled
    var test = global.test;
    if(nohow.notExists("$ROOT/build/Release/polyfill.node")) {
        console.warn("[nohow] Could not load polyfill addon");
        test = test.skip;
    }

    env.command = "echo";
    env.msg = "hello";
    var isWatching = process.argv.indexOf("--watch") !== -1;

    test("spawn", function() {
        var r = nohow.spawn("$command", ["$msg"], { encoding: "utf8" });

        equal(r.file, "echo");
        deepEqual(r.args, ["echo", "hello"]);
        equal(r.stdout, "hello\n");
        equal(r.stderr, "");
        equal(r.status, 0);
        equal(r.error, undefined);
        equal(r.signal, null);
        assert(0 < r.pid);
    });


    if(isWatching === false && nohow.executable("sleep")) {
        test("spawn timeout", function() {
            var r = nohow.spawn("sleep", ["10"], {
                timeout: 500
            });
            equal(r.signal, "SIGTERM");
            assert.instanceOf(r.error, Error);
        });
    }


    test("spawn failed", function() {
        var r = nohow.spawn("not_exists_file__", []);
        equal(r.status, 127);
        assert.instanceOf(r.error, Error);
    });


    test("spawn exit", function () {
        var r = nohow.spawn("node", ["-e", "console.log(1); process.exit(1)"]);
        equal(r.status, 1);
        equal(r.stdout.toString(), "1\n");
    });


    test("exec", function() {
        var res = nohow.exec("$command $msg world").toString();
        equal(res, "hello world\n");
    });


    test("exec throws error", function () {
        assert.throws(function () {
            nohow.exec("exit 1");
        }, "Command failed");
    });


    test("popen", function() {
        var r = nohow.popen("$command $msg && exit 1", { encoding: "utf-8" });
        equal(r.status, 1);
        equal(r.stdout, "hello\n");
        equal(r.stderr, "");
    });


    test("shell", function() {
        assert.doesNotThrow(function () {
            nohow.shell("exit 0");
        });

        assert.throws(function () {
            nohow.shell("exit 1");
        });
    });
});
