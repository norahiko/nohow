'use strict';

var tools = require('./tools.js');
var helper = require('./helper.js');
var fs = require('fs');
var pathModule = require('path');

var WATCH_INTERVAL = 50; // ms
var WATCH_DELAY = 50; // ms
var MAX_STORE_MODIFIED_FILES = 100;
var watcherCounter = 1;

module.exports = Watcher;


function taskCallback(error) {
    if(error) {
        console.error(error.stack);
    }
}


/**
 * Watcher class
 */

function Watcher(pattern, taskNames, func) {
    this._lastModifiedTime = {};
    this._watchers = {};
    this._modifiedFiles = [];
    this._wating = false;

    var name = 'watch_' + watcherCounter++;
    this.files = [];
    this.task = tools.task(name, taskNames, func);
    var paths = tools.glob(pattern);
    this._watchStart(paths);
}


Watcher.prototype._watchStart = function(paths) {
    var watcher = this;

    this.startTask = function() {
        watcher._wating = false;
        watcher.task.start(taskCallback);
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
                watcher.notify(path);
                watchStart();
            });
            watcher._watchers[path] = w;
        }
    });
};


Watcher.prototype.notify = function(path) {
    var last = this._lastModifiedTime[path] || 0;
    var now = Date.now();
    if(last < now - WATCH_INTERVAL) {
        this._lastModifiedTime[path] = now;

        if(this._modifiedFiles.length < MAX_STORE_MODIFIED_FILES) {
            this._modifiedFiles.push(path);
        }
        if(this._wating) { return; }
        this._wating = true;
        setTimeout(this.startTask, WATCH_DELAY);
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
