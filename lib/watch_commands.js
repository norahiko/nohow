'use strict';

var commands = require('./commands.js');
var helper = require('./helper.js');
var fs = require('fs');
var pathModule = require('path');

var watcherCounter = 1;

commands.watchInterval = 50; // ms

commands.watchDelay = 50; // ms

commands.maxStoreWatchFiles = 100;

module.exports = Watcher;

function noop() {}


function taskCallback(error) {
    if(error) {
        console.error(error.stack);
    }
}


function Watcher(pattern, taskNames) {
    this._lastModifiedTime = {};
    this._watchers = {};
    this._modifiedFiles = [];
    this._wating = false;

    var name = 'watch_' + watcherCounter++;
    this.files = [];
    this.task = commands.task(name, taskNames, noop);
    var paths = commands.glob(pattern);
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
    if(last < now - commands.watchInterval) {
        this._lastModifiedTime[path] = now;

        if(this._modifiedFiles.length < commands.maxStoreWatchFiles) {
            this._modifiedFiles.push(path);
        }
        if(this._wating) { return; }
        this._wating = true;
        setTimeout(this.startTask, commands.watchDelay);
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
