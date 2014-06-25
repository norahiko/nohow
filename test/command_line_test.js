"use strict";

var commandLine = require("../lib/command_line.js");
var CommandLine = commandLine.CommandLine;
var chai = require("chai");

var assert = chai.assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;


suite("CommandLine:", function() {
    test("parseArgs", function() {
        var cl = new CommandLine([
            "-f", "jubfile.js", "-x", "foo,bar", "-x", "jub-baz",
            "taskA", "taskB", "--help", "-t", "EnvName=EnvValue",
        ]);
        cl.parseArgs();

        deepEqual(cl.jubfile, "jubfile.js");
        deepEqual(cl.tasks, ["taskA", "taskB"]);
        deepEqual(cl.helpFlag, true);
        deepEqual(cl.taskListFlag, true);
        deepEqual(
            cl.excludePlugins,
            {
                "jub-foo": true,
                "jub-bar": true,
                "jub-baz": true,
            }
        );
        equal(process.env.EnvName, "EnvValue");
    });


    test("generate jubfile header", function() {
        var cl = new CommandLine([]);
        var script = cl.generateJubfileHeader();

        assert(500 < script.length);
        assert(script.indexOf("\n") === -1);
        assert.doesNotThrow(function () {
            eval(script);
        });
    });
});
