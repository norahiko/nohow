'use strict';

var assert = require('assert');
var fs = require('fs');
var pathModule = require('path');

module.exports = new Tempdir('ruskjs');

function Tempdir(dirname) {
    assert(typeof dirname === 'string');
    this.dirname = dirname;
    this.path = pathModule.join(require('os').tmpdir(), dirname);
    this.ensured = false;
    // Remember created files. It will be used for clean up.
    this.created = [];
    this.retry = 10;
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

Tempdir.prototype.getTempfilePath = function(prefix) {
    assert(typeof prefix === 'string');
    this.ensureTempdir();
    var tempfileName = prefix + '_' + Math.random().toString(16).slice(2) +
                                '_' + Math.random().toString(16).slice(2);
    return pathModule.join(this.path, tempfileName);
};

Tempdir.prototype.createTempfile = function (prefix, content) {
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
            console.log(err);
            // retry
        }
    }
    throw new Error('Could not create tempfile');
};

Tempdir.prototype.loadConfigFile = function(filename) {
    var path = pathModule.join(this.path, filename);
    try {
        var contents = fs.readFileSync(path, 'utf8');
        return JSON.parse(contents);
    } catch(err) {
        fs.writeFileSync(path, '{}', 'utf8');
        return {};
    }
};

Tempdir.prototype.saveConfigFile = function(filename, data) {
    var path = pathModule.join(this.path, filename);
    var contents = fs.readFileSync(path, 'utf8');
    return JSON.parse(contents);
};

Tempdir.prototype.clearTempfile = function() {
    this.created.forEach(fs.unlinkSync);
};
