'use strict';

Error.stackTraceLimit = 7;
var jub = require('../lib/jub.js');
var http = require('http');

var assert = require('chai').assert;
var equal = assert.strictEqual;
var env = jub.env;
var root = process.cwd();


suite('Expand command:', function () {
    env.key = 'value';
    env.file = 'dir/file.js';
    env.object = {key: [1, 2, ['piyo']], path: 'path.obj'};
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
        equal(jub.expand('$key'), 'value');
        equal(jub.expand('${key}'), 'value');
        equal(jub.expand('/a/$key/b'), '/a/value/b');
        equal(jub.expand('$cwd'), '/test');
        equal(jub.expand('$file'), 'dir/file.js');
        equal(jub.expand('~'), process.env.HOME);
    });


    test('expand attributes', function() {
        equal(jub.expand('$file.length'), '11');
        equal(jub.expand('${file.length}'), '11');
        equal(jub.expand('$object.key.2.0'), 'piyo');
        equal(jub.expand('${object.path:abs}'), '/test/path.obj');
    });


    test('expand filter', function() {
        if(process.platform !== 'win32') {
            equal(jub.expand('$file:abs'), '/test/dir/file.js');
            equal(jub.expand('${file:abs}'), '/test/dir/file.js');
        }
        equal(jub.expand('$file:dir'), 'dir');
        equal(jub.expand('$file:base'), 'file.js');
        equal(jub.expand('$file:rmext'), 'dir/file');
        equal(jub.expand('$0:digit2', 0), '00');
        equal(jub.expand('$0:digit2', 1), '01');
        equal(jub.expand('$0:digit2', -1), '-01');
        equal(jub.expand('$0:digit2', 1.234), '01');
        equal(jub.expand('$0:digit2', 1.9), '01');
        equal(jub.expand('$0:digit2', -1.9), '-01');
        equal(jub.expand('$0:digit2', 10), '10');
        equal(jub.expand('$0:digit2', -10), '-10');
        equal(jub.expand('$0:digit2', 100), '100');
        equal(jub.expand('$0:digit2', -100), '-100');
        equal(jub.expand('$0:digit6', 123), '000123');
    });


    test('expand arguments', function() {
        equal(jub.expand('Hello, $0', 'jubJS'), 'Hello, jubJS');
        equal(jub.expand('$0$1 is not $0', 'Java', 'Script'), 'JavaScript is not Java');
    });


    test('not expanded', function () {
        equal(jub.expand('${key'), '${key');

    });


    test('expand error', function() {
        assert.throws(function() {
            jub.expand('$undefined');
        });

        assert.throws(function() {
            jub.expand('$0');
        });

        assert.throws(function() {
            jub.expand('$1', 'foo');
        });

        assert.throws(function() {
            jub.expand('$object.undefined');
        });

        assert.throws(function() {
            jub.expand('$0:undefined_filter', 'value');
        });
    });
});


suite('Misc command:', function() {
    setup(function () {
        process.chdir(root);
    });


    test('defined', function() {
        for(var name in jub.commands) {
            assert.isDefined(jub.commands[name], 'commands.' + name + ' is undefined');
        }
    });


    test('trace', function() {
        var output;
        var log = console.log;
        try {
            console.log = function() {
                output = arguments;
            };
            jub.trace('ok');
        } finally {
            console.log = log;
        }

        equal(output.length, 2);
        assert(/command_test\.js/.test(output[0]));
        assert(output[1], 'ok');
    });


    test('executable', function() {
        assert(jub.executable('node'));
        assert(! jub.executable('not a binary file'));
    });
});


suite('StaticServer', function() {
    var server;

    setup(function (done) {
        env.STATIC_PORT = 7878;
        env.STATIC_HOST = 'localhost';
        server = jub.staticserver({
            documentRoot: root,
            listenCallback: done,
        });
    });


    teardown(function (done) {
        server.close(done);
    });


    test('root dir', function(done) {
        http.get('http://localhost:7878/', function(res) {
            equal(res.statusCode, 200);
            equal(res.headers['content-type'], 'text/html');
            res.resume();
            done();
        });
    });


    test('lib dir', function(done) {
        http.get('http://localhost:7878/lib/', function(res) {
            equal(res.statusCode, 200);
            equal(res.headers['content-type'], 'text/html');
            res.resume();
            done();
        });
    });


    test('redirect', function(done) {
        http.get('http://localhost:7878/lib', function(res) {
            equal(res.statusCode, 301);
            equal(res.headers.location, '/lib/');
            res.resume();
            done();
        });
    });


    test('200', function(done) {
        http.get('http://localhost:7878/LICENSE', function(res) {
            equal(res.statusCode, 200);
            res.on('data', function(data) {
                equal(data.toString().slice(0, 15), 'The MIT License');
                done();
            });
        });
    });


    test('404', function(done) {
        http.get('http://localhost:7878/not_exists_file', function(res) {
            res.resume();
            equal(res.statusCode, 404);
            done();
        });
    });
});
