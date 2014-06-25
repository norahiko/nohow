"use strict";

var tools = require("./tools.js");
var helper = require("./helper.js");
var fs = require("fs");
var pathModule = require("path");

module.exports = Watcher;
Watcher.WATCH_INTERVAL = 50; // ms
Watcher.WATCH_DELAY = 25; // ms
Watcher.MAX_STORE_MODIFIED_FILES = 100;


/**
 * Watcher class
 */

function Watcher(pattern, callback) {
    this.pattern = pattern;
    this.callback = callback;
    this._lastModifiedTime = {};
    this._watchers = {};
    this._modifiedFiles = [];
    this._wating = false;

    this.files = [];
    var paths = tools.glob(pattern);
    if(paths.length === 0) {
        throw new Error("jub.Watcher: '" + pattern + "' no such file or directory");
    }
    this._watchStart(paths);
}


Watcher.prototype._watchStart = function(paths) {
    var watcher = this;

    this._onModified = function() {
        watcher._wating = false;
        watcher.callback();
    };

    paths.forEach(function(path) {
        path = pathModule.resolve(path);
        if(fs.statSync(path).isFile() === false) { return; }
        watcher.files.push(path);

        watchStart();
        var w;
        function watchStart() {
            w && w.close();
            w = fs.watch(path, function(event, _) {
                watcher._notify(path);
                watchStart();
            });
            watcher._watchers[path] = w;
        }
    });
};


Watcher.prototype._notify = function(path) {
    var last = this._lastModifiedTime[path] || 0;
    var now = Date.now();
    if(last < now - Watcher.WATCH_INTERVAL) {
        this._lastModifiedTime[path] = now;

        if(this._modifiedFiles.length < Watcher.MAX_STORE_MODIFIED_FILES) {
            this._modifiedFiles.push(path);
        }
        if(this._wating) { return; }
        this._wating = true;
        setTimeout(this._onModified, Watcher.WATCH_DELAY);
    }
};


Watcher.prototype.getModifiedFiles = function() {
    var modified = helper.unique(this._modifiedFiles);
    this._modifiedFiles.length = 0;
    return modified;
};


Watcher.prototype.close = function() {
    for(var path in this._watchers) {
        this._watchers[path].close();
    }
};
