'use strict';

Error.stackTraceLimit = 7;
var rusk = require('../lib/rusk.js');

var assert = require('chai').assert;
var equal = assert.strictEqual;
var env = rusk.env;

var root = process.cwd();

suite('Expand command:', function () {
    env.key = 'value';
    env.file = 'dir/file.js';
    env.object = {key: [1, 2, ['piyo']]};

    var _cwd = process.cwd;

    setup(function() {
        process.cwd = function() {
            return '/test';
        };
    });

    teardown(function() {
        process.cwd = _cwd;
    });

    test('expand env', function () {
        equal(rusk.expand('$key'), 'value');
        equal(rusk.expand('${key}'), 'value');
        equal(rusk.expand('/a/$key/b'), '/a/value/b');
        equal(rusk.expand('$cwd'), '/test');
        equal(rusk.expand('$file'), 'dir/file.js');
        equal(rusk.expand('~'), process.env.HOME);
    });

    test('expand attributes', function() {
        equal(rusk.expand('$file.length'), '11');
        equal(rusk.expand('$object.key.2.0'), 'piyo');
    });

    test('expand filter', function() {
        if(process.platform !== 'win32') {
            equal(rusk.expand('$file:abs'), '/test/dir/file.js');
            equal(rusk.expand('${file:abs}'), '/test/dir/file.js');
        }
        equal(rusk.expand('$file:dir'), 'dir');
        equal(rusk.expand('$file:base'), 'file.js');
        equal(rusk.expand('$file:rmext'), 'dir/file');
        equal(rusk.expand('$file:base:rmext'), 'file');
    });

    test('expand arguments', function() {
        equal(rusk.expand('Hello, $0', 'RuskJS'), 'Hello, RuskJS');
        equal(rusk.expand('$0$1 is not $0', 'Java', 'Script'), 'JavaScript is not Java');
    });

    test('not expanded', function () {
        equal(rusk.expand('${key'), '${key');

    });

    test('expand error', function() {
        assert.throws(function() {
            rusk.expand('$undefined');
        });

        assert.throws(function() {
            rusk.expand('$0');
        });

        assert.throws(function() {
            rusk.expand('$1', 'foo');
        });

        assert.throws(function() {
            rusk.expand('$object.undefined');
        });

        assert.throws(function() {
            rusk.expand('$0:undefined_filter', 'value');
        });
    });
});


suite('Misc command:', function() {
    setup(function () {
        process.chdir(root);
    });

    test('defined', function() {
        for(var name in rusk.commands) {
            assert.isDefined(rusk.commands[name], 'commands.' + name + ' is undefined');
        }
    });

    test('trace', function() {
        var output;
        var log = console.log;
        try {
            console.log = function() {
                output = arguments;
            };
            rusk.trace('ok');
        } finally {
            console.log = log;
        }

        equal(output.length, 2);
        assert(/command_test\.js/.test(output[0]));
        assert(output[1], 'ok');
    });
});

