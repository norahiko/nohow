'use strict';

var commands = require('./commands.js');
var helper = require('./helper.js');
var fs = require('fs');
var pathModule = require('path');

var watcherCounter = 1;

commands.watchInterval = 50; // ms

commands.watchDelay = 50; // ms

commands.maxStoreFiles = 100;


function noop() {}


function taskCallback(error) {
    if(error) {
        console.error(error.stack);
    }
}


commands.watch = function watch(pattern, taskNames) {
    var paths = commands.glob(pattern);
    var lastModifiedTime = {};
    var watchingFiles = [];

    var watchers = {};
    var modifiedFiles = [];

    var taskName = 'watch_' + watcherCounter++;
    var task = commands.task(taskName, taskNames, noop);

    paths.forEach(function(path) {
        path = pathModule.resolve(path);
        if(fs.statSync(path).isFile() === false) { return; }
        watchingFiles.push(path);

        watchStart();
        var w;
        function watchStart() {
            w && w.close();
            w = fs.watch(path, function(event, _) {
                notify(path);
                watchStart();
            });
            watchers[path] = w;
        }
    });

    var wating = false;

    function start() {
        wating = false;
        task.start(taskCallback);
    }

    function notify(path) {
        var last = lastModifiedTime[path] || 0;
        var now = Date.now();
        if(last < now - commands.watchInterval) {
            lastModifiedTime[path] = now;

            if(modifiedFiles.length < commands.maxStoreFiles) {
                modifiedFiles.push(path);
            }
            if(wating) { return; }
            wating = true;
            setTimeout(start, commands.watchDelay);
        }
    }

    return {
        files: watchingFiles,

        getModifiedFiles: function() {
            var modified = helper.unique(modifiedFiles);
            modifiedFiles.length = 0;
            return modified;
        },

        close: function close() {
            for(var path in watchers) {
                watchers[path].close();
            }
        }
    };
};

module.exports = commands.watch;
