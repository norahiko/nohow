'use strict';

var jub = require('../lib/jub.js');
var chai = require('chai');
var assert = chai.assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
var env = jub.env;

suite('ExecSync:', function() {
    // skip tests if exec tool is not available
    try {
        assert(jub.exec('node -e \'console.log("ok")\'').toString() === 'ok\n');
    } catch(err) {
        return;
    }

    env.command = 'echo';
    env.msg = 'hello';
    var isWatching = process.argv.indexOf('--watch') !== -1;

    test('spawn', function() {
        var r = jub.spawn('$command', ['$msg'], { encoding: 'utf8' });

        equal(r.file, 'echo');
        deepEqual(r.args, ['echo', 'hello']);
        equal(r.stdout, 'hello\n');
        equal(r.stderr, '');
        equal(r.status, 0);
        equal(r.error, undefined);
        equal(r.signal, undefined);
        assert(0 < r.pid);
    });


    if(isWatching === false && jub.executable('sleep')) {
        test('spawn timeout', function() {
            var r = jub.spawn('sleep', ['10'], {
                timeout: 500
            });
            equal(r.signal, 'SIGTERM');
        });
    }


    test('spawn failed', function() {
        var r = jub.spawn('not_exists_file__');
        equal(r.status, 127);
        assert.instanceOf(r.error, Error);
    });


    test('spawn exit', function () {
        var r = jub.spawn('node', ['-e', 'console.log(1); process.exit(1)']);
        equal(r.status, 1);
        equal(r.stdout.toString(), '1\n');
    });


    test('exec', function() {
        var res = jub.exec('$command $msg world').toString();
        equal(res, 'hello world\n');
    });


    test('exec throws error', function () {
        assert.throws(function () {
            jub.exec('exit 1');
        }, 'Command failed');
    });


    test('shell', function() {
        var r = jub.shell('$command $msg && exit 1', { encoding: 'utf-8' });
        equal(r.status, 1);
        equal(r.stdout, 'hello\n');
        equal(r.stderr, '');
    });


    test('system', function() {
        var good = jub.system('exit 0');
        equal(good, true);

        var bad = jub.system('exit 1');
        equal(bad, false);
    });
});
