'use strict';

var tempdir = require('../lib/tempdir.js');
var fs = require('fs');
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
        var config = tempdir.loadConfigFile('test');
        equal(tempdir.loadConfigFile('test'), config);
        config.key = 'value';
        tempdir.saveConfigFiles();
        tempdir.configFiles = Object.create(null);

        var reloadConfig = tempdir.loadConfigFile('test');
        assert.notEqual(config, reloadConfig);
        assert.deepEqual(config, reloadConfig);
    });
});
