"use strict";

var jub = require("../lib/jub.js");
var chai = require("chai");
var assert = chai.assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
var env = jub.env;

suite("ExecSync:", function() {
    // skip tests if polyfill wasn't compiled
    var test = global.test;
    if(jub.notExists("$root/build/Release/polyfill.node")) {
        test = test.skip;
    }

    env.command = "echo";
    env.msg = "hello";
    var isWatching = process.argv.indexOf("--watch") !== -1;

    test("spawn", function() {
        var r = jub.spawn("$command", ["$msg"], { encoding: "utf8" });

        equal(r.file, "echo");
        deepEqual(r.args, ["echo", "hello"]);
        equal(r.stdout, "hello\n");
        equal(r.stderr, "");
        equal(r.status, 0);
        equal(r.error, undefined);
        equal(r.signal, null);
        assert(0 < r.pid);
    });


    if(isWatching === false && jub.executable("sleep")) {
        test("spawn timeout", function() {
            var r = jub.spawn("sleep", ["10"], {
                timeout: 500
            });
            equal(r.signal, "SIGTERM");
            assert.instanceOf(r.error, Error);
        });
    }


    test("spawn failed", function() {
        var r = jub.spawn("not_exists_file__", []);
        equal(r.status, 127);
        assert.instanceOf(r.error, Error);
    });


    test("spawn exit", function () {
        var r = jub.spawn("node", ["-e", "console.log(1); process.exit(1)"]);
        equal(r.status, 1);
        equal(r.stdout.toString(), "1\n");
    });


    test("exec", function() {
        var res = jub.exec("$command $msg world").toString();
        equal(res, "hello world\n");
    });


    test("exec throws error", function () {
        assert.throws(function () {
            jub.exec("exit 1");
        }, "Command failed");
    });


    test("popen", function() {
        var r = jub.popen("$command $msg && exit 1", { encoding: "utf-8" });
        equal(r.status, 1);
        equal(r.stdout, "hello\n");
        equal(r.stderr, "");
    });


    test("shell", function() {
        assert.doesNotThrow(function () {
            jub.shell("exit 0");
        });

        assert.throws(function () {
            jub.shell("exit 1");
        });
    });
});
