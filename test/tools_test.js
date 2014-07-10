"use strict";

Error.stackTraceLimit = 7;
var nohow = require("../lib/nohow.js");
var http = require("http");

var assert = require("chai").assert;
var equal = assert.strictEqual;
var env = nohow.env;
var root = process.cwd();


suite("Expand tool:", function () {
    env.key = "value";
    env.file = "dir/file.js";
    env.object = {key: [1, 2, ["piyo"]], path: "path.obj"};
    var _cwd = process.cwd;

    setup(function() {
        process.cwd = function() {
            return "/test";
        };
    });


    teardown(function() {
        process.cwd = _cwd;
    });


    test("expand env", function () {
        equal(nohow.expand("$key"), "value");
        equal(nohow.expand("${key}"), "value");
        equal(nohow.expand("/a/$key/b"), "/a/value/b");
        equal(nohow.expand("$cwd"), "/test");
        equal(nohow.expand("$file"), "dir/file.js");
        equal(nohow.expand("~"), process.env.HOME);
    });


    test("expand attributes", function() {
        equal(nohow.expand("$file.length"), "11");
        equal(nohow.expand("${file.length}"), "11");
        equal(nohow.expand("$object.key.2.0"), "piyo");
        equal(nohow.expand("${object.path:abs}"), "/test/path.obj");
    });


    test("expand filter", function() {
        if(process.platform !== "win32") {
            equal(nohow.expand("$file:abs"), "/test/dir/file.js");
            equal(nohow.expand("${file:abs}"), "/test/dir/file.js");
        }
        equal(nohow.expand("$file:dir"), "dir");
        equal(nohow.expand("$file:base"), "file.js");
        equal(nohow.expand("$file:rmext"), "dir/file");
        equal(nohow.expand("$0:digit2", 0), "00");
        equal(nohow.expand("$0:digit2", 1), "01");
        equal(nohow.expand("$0:digit2", -1), "-01");
        equal(nohow.expand("$0:digit2", 1.234), "01");
        equal(nohow.expand("$0:digit2", 1.9), "01");
        equal(nohow.expand("$0:digit2", -1.9), "-01");
        equal(nohow.expand("$0:digit2", 10), "10");
        equal(nohow.expand("$0:digit2", -10), "-10");
        equal(nohow.expand("$0:digit2", 100), "100");
        equal(nohow.expand("$0:digit2", -100), "-100");
        equal(nohow.expand("$0:digit6", 123), "000123");
    });


    test("expand arguments", function() {
        equal(nohow.expand("Hello, $0", "Nohow"), "Hello, Nohow");
        equal(nohow.expand("$0$1 is not $0", "Java", "Script"), "JavaScript is not Java");
    });


    test("not expanded", function () {
        equal(nohow.expand("${key"), "${key");

    });


    test("expand array", function() {
        var ary = ["foo", "bar", "baz"];
        equal(nohow.expand("$0", ary), "foo bar baz");
    });


    test("expand error", function() {
        assert.throws(function() {
            nohow.expand("$undefined");
        });

        assert.throws(function() {
            nohow.expand("$0");
        });

        assert.throws(function() {
            nohow.expand("$1", "foo");
        });

        assert.throws(function() {
            nohow.expand("$object.undefined");
        });

        assert.throws(function() {
            nohow.expand("$0:undefined_filter", "value");
        });
    });
});


suite("Misc tool:", function() {
    setup(function () {
        process.chdir(root);
    });


    test("defined", function() {
        for(var name in nohow.tools) {
            assert.isDefined(nohow.tools[name], "tools." + name + " is undefined");
        }
    });


    test("executable", function() {
        assert(nohow.executable("node"));
        assert(! nohow.executable("not a binary file"));
    });
});


suite("StaticServer", function() {
    var server;

    setup(function (done) {
        env.staticPort = 7878;
        env.staticHost = "localhost";
        server = nohow.StaticServer({
            documentRoot: root,
            callback: done,
        });
    });


    teardown(function (done) {
        server.close(done);
    });


    test("root dir", function(done) {
        http.get("http://localhost:7878/", function(res) {
            equal(res.statusCode, 200);
            equal(res.headers["content-type"], "text/html");
            res.resume();
            done();
        });
    });


    test("lib dir", function(done) {
        http.get("http://localhost:7878/lib/", function(res) {
            equal(res.statusCode, 200);
            equal(res.headers["content-type"], "text/html");
            res.resume();
            done();
        });
    });


    test("redirect", function(done) {
        http.get("http://localhost:7878/lib", function(res) {
            equal(res.statusCode, 301);
            equal(res.headers.location, "/lib/");
            res.resume();
            done();
        });
    });


    test("200", function(done) {
        http.get("http://localhost:7878/LICENSE", function(res) {
            equal(res.statusCode, 200);
            res.on("data", function(data) {
                equal(data.toString().slice(0, 15), "The MIT License");
                done();
            });
        });
    });


    test("404", function(done) {
        http.get("http://localhost:7878/not_exists_file", function(res) {
            res.resume();
            equal(res.statusCode, 404);
            done();
        });
    });
});
