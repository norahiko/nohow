'use strict';

var helper = require('../lib/helper.js');
var chai = require('chai');
var assert = chai.assert;
var deepEqual = assert.deepEqual;


suite('Lazylib', function() {
    test('lazylib', function() {
        assert.isDefined(helper.lazylib.glob, 'lazylib.glob');
    });
});


suite('Fs helper:', function() {
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
