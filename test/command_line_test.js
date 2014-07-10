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
            "-f", "nohow.js", "-x", "foo,bar", "-x", "nohow-baz",
            "taskA", "taskB", "--help", "-t", "EnvName=EnvValue",
        ]);
        cl.parseArgs();

        deepEqual(cl.nohowFileName, "nohow.js");
        deepEqual(cl.tasks, ["taskA", "taskB"]);
        deepEqual(cl.helpFlag, true);
        deepEqual(cl.taskListFlag, true);
        deepEqual(
            cl.excludePlugins,
            {
                "nohow-foo": true,
                "nohow-bar": true,
                "nohow-baz": true,
            }
        );
        equal(process.env.EnvName, "EnvValue");
    });


    test("generate nohow file header", function() {
        var cl = new CommandLine([]);
        var script = cl.generateNohowFileHeader();

        assert(500 < script.length);
        assert(script.indexOf("\n") === -1);
    });
});
