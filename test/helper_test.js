'use strict';

var helper = require('../lib/helper.js');
var chai = require('chai');
var assert = chai.assert;
var deepEqual = assert.deepEqual;


suite('Lazylib:', function() {
    test('lazylib', function() {
        assert.isDefined(helper.lazylib.glob, 'lazylib.glob');
        assert.isDefined(helper.lazylib.Watcher, 'lazylib.Watcher');
    });
});


suite('Jub system helper:', function() {
    test('parseArgs', function() {
        var opts = helper.parseArgs([
            '-f', 'jubfile.js', '-x', 'foo,bar', '-x', 'jub-baz',
            'taskA', 'taskB', '--help', '-T'
        ]);

        deepEqual(opts.jubfilePath, 'jubfile.js');
        deepEqual(opts.excludePlugins, ['jub-foo', 'jub-bar', 'jub-baz']);
        deepEqual(opts.tasks, ['taskA', 'taskB']);
        deepEqual(opts.helpFlag, true);
        deepEqual(opts.taskListFlag, true);
    });
});


suite('Array helper:', function() {
    test('unique', function() {
        deepEqual(
            helper.unique([1, 2, 3, 3, 2, 1, 4, 4, 5]),
            [1, 2, 3, 4, 5]
        );
    });


    test('flatten', function() {
        deepEqual(
            helper.flatten([[1],[2],[3, 4], 5]),
            [1, 2, 3, 4, 5]
        );
    });
});


suite('Exec helper:', function() {
    test('shellsplit', function() {
        deepEqual(
            helper.shellSplit('command -f dir/*.js'),
            ['command', ' ', '-f', ' ', 'dir/*.js']
        );

        deepEqual(
            helper.shellSplit('echo " text ${data}"|grep $s>output'),
            ['echo', ' ', '" text ${data}"', '|', 'grep', ' ', '$s', '>', 'output']
        );
    });
});
