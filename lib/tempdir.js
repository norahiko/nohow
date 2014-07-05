"use strict";

var tools = require("./tools.js");
var assert = require("assert");
var fs = require("fs");
var pathModule = require("path");

module.exports = new Tempdir(".jub");

function Tempdir(dirname) {
    assert(typeof dirname === "string");
    this.dirname = dirname;
    this.path = null;
    this.retry = 10;

    this.configFiles = {};
    var root = new Buffer(tools.env.root);
    this.configFileSuffix = root.toString("base64").replace(/\//g, "_");
}


Tempdir.prototype.ensureTempdir = function() {
    var path = pathModule.join(tools.env.TMPDIR, this.dirname);
    if(this.path === path) {
        return;
    }

    if(fs.existsSync(path) === false) {
        fs.mkdirSync(path, 511 /* == 0777 */);
    }
    this.path = path;
};


Tempdir.prototype.getTempfilePath = function(prefix) {
    assert(typeof prefix === "string");
    var tempfileName = prefix + "_" + Math.random().toString(16).slice(2) +
                                "_" + Math.random().toString(16).slice(2);
    return pathModule.join(this.path, tempfileName);
};


Tempdir.prototype.createTempfile = function (prefix, content) {
    this.ensureTempdir();
    var count = 0;
    while(count++ < this.retry) {
        try {
            var path = this.getTempfilePath(prefix);
            var fd = fs.openSync(path, "wx");
            if(content) {
                fs.writeSync(fd, content);
            }
            fs.closeSync(fd);
            return path;
        } catch(err) {
            // retry
        }
    }
    throw new Error("Could not create tempfile");
};


Tempdir.prototype.loadConfigFile = function(filename) {
    this.ensureTempdir();
    if(this.configFiles[filename]) {
        return this.configFiles[filename];
    }
    var path = pathModule.join(this.path, filename) + this.configFileSuffix;
    try {
        var contents = fs.readFileSync(path, "utf8");
        var config = JSON.parse(contents);
    } catch(err) {
        config = {};
    }
    this.configFiles[filename] = config;
    return config;
};


Tempdir.prototype.saveConfigFiles = function() {
    this.ensureTempdir();
    var dir = this.path;
    var configFiles = this.configFiles;
    var suffix = this.configFileSuffix;

    Object.keys(configFiles).forEach(function(filename) {
        var path = pathModule.join(dir, filename) + suffix;
        var obj = configFiles[filename];
        var json = JSON.stringify(obj);
        fs.writeFileSync(path, json);
    });
};


Tempdir.prototype.clearTempfiles = function() {
    this.ensureTempdir();
    var files = fs.readdirSync(this.path);
    for(var i = 0; i < files.length; i++) {
        if(/^temp/.test(files[i])) {
            fs.unlinkSync(this.path + pathModule.sep + files[i]);
        }
    }
};
