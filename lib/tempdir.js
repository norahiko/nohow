'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var pathModule = require('path');

module.exports = new Tempdir('ruskjs');

function Tempdir(dirname) {
    assert(typeof dirname === 'string');
    this.dirname = dirname;
    this.path = pathModule.join(os.tmpdir(), dirname);
    this.ensured = false;
    // Remember created files. It will be used for clean up.
    this.created = [];
    this.retry = 10;
    this.configFiles = {};
}

Tempdir.prototype.ensureTempdir = function() {
    if(this.ensured) {
        return;
    }
    if(fs.existsSync(this.path) === false) {
        fs.mkdirSync(this.path, 511 /* == 0777 */);
    }
    this.ensured = true;
};

/**
 * @param {String} prefix
 * @returns {String}
 */
Tempdir.prototype.getTempfilePath = function(prefix) {
    assert(typeof prefix === 'string');
    var tempfileName = prefix + '_' + Math.random().toString(16).slice(2) +
                                '_' + Math.random().toString(16).slice(2);
    return pathModule.join(this.path, tempfileName);
};


/**
 * @param {String} prefix
 * @param {String|Buffer} content
 * @returns {String} tempfile abs path
 */
Tempdir.prototype.createTempfile = function (prefix, content) {
    this.ensureTempdir();
    var count = 0;
    while(count++ < this.retry) {
        try {
            var path = this.getTempfilePath(prefix);
            var fd = fs.openSync(path, 'wx');
            if(content) {
                fs.writeSync(fd, content);
            }
            fs.closeSync(fd);
            this.created.push(path);
            return path;
        } catch(err) {
            // retry
        }
    }
    throw new Error('Could not create tempfile');
};


/**
 * @param {String} filename
 * @returns {Object}
 */
Tempdir.prototype.loadConfigFile = function(filename) {
    this.ensureTempdir();
    if(this.configFiles[filename]) {
        return this.configFiles[filename];
    }
    var path = pathModule.join(this.path, filename);
    var obj;
    try {
        var contents = fs.readFileSync(path, 'utf8');
        obj = JSON.parse(contents);
    } catch(err) {
        obj = {};
    }
    this.configFiles[filename] = obj;
    return obj;
};

Tempdir.prototype.saveConfigFiles = function() {
    this.ensureTempdir();
    var dir = this.path;
    var configFiles = this.configFiles;

    Object.keys(configFiles).forEach(function(filename) {
        var path = pathModule.join(dir, filename);
        var obj = configFiles[filename];
        var json = JSON.stringify(obj);
        fs.writeFileSync(path, json);
    });
};

Tempdir.prototype.clearTempfiles = function() {
    this.ensureTempdir();
    this.created.forEach(fs.unlinkSync);
};
