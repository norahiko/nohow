'use strict';

var tempdir = require('../lib/tempdir.js');
var pathModule = require('path');
var fs = require('fs');
var os = require('os');
var chai = require('chai');
var assert = chai.assert;
var equal = assert.strictEqual;


suite('Tempdir', function() {
    test('create', function() {
        var path = tempdir.createTempfile('temp', 'contents');
        assert(fs.existsSync(path));
        equal(fs.readFileSync(path, 'utf8'), 'contents');
    });

    test('clear files', function() {
        var path = tempdir.createTempfile('temp', 'contents');
        tempdir.clearTempfiles();
        assert(false === fs.existsSync(path));
    });

    test('config file', function() {
        var path = os.tmpdir() + pathModule.sep + 'ruskjs' + pathModule.sep + '__test';
        fs.writeFileSync(path, '{"key":"value"}');

        var config = tempdir.loadConfigFile('__test');
        equal(tempdir.loadConfigFile('__test'), config);
        equal(config.key, 'value');
        tempdir.saveConfigFiles();
    });
});
