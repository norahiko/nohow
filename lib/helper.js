"use strict";

var helper = exports;
var fs = require("fs");
var pathModule = require("path");

// Jub uses lazy loaded libraries
// it makes startup faster
helper.lazylib = {};

setLazyLib(helper.lazylib, "glob", "glob");
setLazyLib(helper.lazylib, "Watcher", "./watcher.js");
setLazyLib(helper.lazylib, "StaticServer", "./static_server.js");
setLazyLib(helper.lazylib, "childProcessSync", "./child_process_sync.js");


function setLazyLib(ns, key, libname) {
    Object.defineProperty(ns, key, {
        configurable: true,
        get: function() {
            var lib = require(libname);
            delete ns[key];
            ns[key] = lib;
            return lib;
        },
    });
}


helper.getTraceInfo = function(stack, depth) {
    var traceRaw = stack.split("\n")[depth + 1];
    var match = traceRaw.match(/\(([^)]+)\)$/);
    if(match) {
        var srcLineCol = match[1].split(":");
    } else {
        srcLineCol = traceRaw.match(/at (.+)/)[1].split(":");
    }

    if(srcLineCol.length < 2) {
        srcLineCol[1] = "?";
        srcLineCol[2] = "?";
    }
    return {
        src: srcLineCol[0],
        line: srcLineCol[1],
        col: srcLineCol[2],
    };
};


// ----------------------------------------
// Array utility

helper.isArrayLike = function(obj) {
    return obj && obj.length !== undefined && typeof obj !== "string";
};


helper.flatten = function(arg) {
    if(helper.isArrayLike(arg) === false) {
        return [arg];
    }

    var result = [];
    for(var i = 0; i < arg.length; i++) {
        if(helper.isArrayLike(arg[i])) {
            var sub = helper.flatten(arg[i]);
            for(var k = 0; k < sub.length; k++) {
                result.push(sub[k]);
            }
        } else {
            result.push(arg[i]);
        }
    }
    return result;
};


helper.unique = function(ary) {
    var set = Object.create(null);
    var result = [];

    for(var i = 0; i < ary.length; i++) {
        var elem = ary[i];
        if(set[elem] === undefined) {
            set[elem] = true;
            result.push(elem);
        }
    }
    return result;
};


// ----------------------------------------
// Shell tools helper

helper.joinPath = function(dir, file) {
    return dir + pathModule.sep + file;
};


helper.spaces = function(length) {
    return "                                                            ".slice(0, length);
};


helper.readdirWithDirname = function(dir) {
    if(dir[dir.length - 1] !== pathModule.sep) {
        dir += pathModule.sep;
    }
    var files = fs.readdirSync(dir);
    var paths = [];
    for(var i = 0; i < files.length; i++) {
        paths.push(dir + files[i]);
    }
    return paths;
};


helper.mkdirp = function mkdirp(dir) {
    try {
        if(fs.statSync(dir).isDirectory()) {
            return;
        }
    } catch(err) {
        if(err.code !== "ENOENT") {
            throw err;
        }
        mkdirp(pathModule.dirname(dir));
        fs.mkdirSync(dir);
        return;
    }
    var err = new Error("EEXIST, file already exists \"" + dir + "\"");
    err.code = "EEXIST";
    throw err;
};


helper.move = function(oldpath, file_or_dir) {
    try {
        if(fs.statSync(file_or_dir).isDirectory()) {
            // move into directory
            var basename = pathModule.basename(oldpath);
            var newpath = pathModule.join(file_or_dir, basename);
            fs.renameSync(oldpath, newpath);
            return;
        }
    } catch(err) {
        if(err.code !== "ENOENT") { throw err; }
    }
    fs.renameSync(oldpath, file_or_dir);
};


helper.moveInto = function(paths, dir) {
    paths.forEach(function(oldpath) {
        var basename = pathModule.basename(oldpath);
        var newpath = pathModule.join(dir, basename);
        fs.renameSync(oldpath, newpath);
    });
};


helper.copyAny = function(src, dest) {
    var stat = fs.lstatSync(src);
    if(stat.isFile()) {
        helper.copyFile(src, dest);

    } else if(stat.isDirectory()) {
        helper.copyDir(src, dest);

    } else if(stat.isSymbolicLink()) {
        helper.copyLink(src, dest);
    }
    // ignore other types
};


helper.copyDir = function(srcDir, destDir) {
    try {
        fs.mkdirSync(destDir);
    } catch(err) {
        if(err.code !== "EEXIST") { throw err; }
    }

    var files = fs.readdirSync(srcDir);
    if(srcDir.charAt(srcDir.length - 1) !== pathModule.sep) {
        srcDir += pathModule.sep;
    }

    for(var i = 0; i < files.length; i++) {
        var srcPath = srcDir + files[i];
        var destPath = destDir + pathModule.sep + files[i];
        helper.copyAny(srcPath, destPath);
    }
};


helper.copyFile = function(src, dest) {
    var srcfd = fs.openSync(src, "r");
    var destfd = fs.openSync(dest, "w");
    var bufsize = 8192;
    var buffer = new Buffer(bufsize);

    try {
        while(true) {
            var readSize = fs.readSync(srcfd, buffer, 0, bufsize);
            if(readSize === 0) {
                break;
            }
            fs.writeSync(destfd, buffer, 0, readSize);
        }
    } finally {
        fs.closeSync(srcfd);
        fs.closeSync(destfd);
    }
};


helper.copyLink = function(src, dest) {
    var link = fs.readlinkSync(src);
    try {
        fs.symlinkSync(link, dest);
    } catch(err) {
        if(err.code !== "EEXIST") { throw err; }
        fs.unlinkSync(dest);
        fs.symlinkSync(link, dest);
    }
};


helper.removeTree = function(path) {
    if(fs.lstatSync(path).isDirectory()) {
        var subpaths = helper.readdirWithDirname(path);
        subpaths.forEach(helper.removeTree);
        fs.rmdirSync(path);
    } else {
        fs.unlinkSync(path);
    }
};


helper.shellSplit = function(command) {
    return command.match(/\s+|[&|<>]|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|.(?:\\.|[^\s&|<>])*/g) || [];
};
