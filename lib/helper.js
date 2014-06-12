'use strict';

var helper = exports;
var fs = require('fs');
var vm = require('vm');
var pathModule = require('path');

// Jub uses lazy loaded libraries
// it makes startup fater
helper.lazylib = {};

setLazyLib(helper.lazylib, 'glob', 'glob');
setLazyLib(helper.lazylib, 'Watcher', './watcher.js');
setLazyLib(helper.lazylib, 'webserver', './webserver.js');


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

// ----------------------------------------
// Array utility

helper.isArrayLike = function(obj) {
    return obj.length !== undefined && typeof obj !== 'string';
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
    ary.forEach(function(elem) {
        if(set[elem]) {
            return;
        }
        set[elem] = true;
        result.push(elem);
    });
    return result;
};

// ----------------------------------------
// Jub system helper

helper.findJubfiles = function() {
    var cwd = process.cwd();
    var files = fs.readdirSync(cwd);
    var result = [];
    files.forEach(function(file) {
        if(/^jubfile/i.test(file)) {
            result.push(pathModule.join(cwd, file));
        }
    });
    return result;
};


helper.loadJSON = function(filename) {
    var json = fs.readFileSync(filename, 'utf8');
    try {
        return JSON.parse(json);
    } catch(err) {
        return vm.runInThisContext('(' + json + ')');
    }
};


helper.joinPath = function(dir, file) {
    return dir + pathModule.sep + file;
};


helper.searchPluginNames = function() {
    var libs = searchLibs();
    return libs.filter(function(lib) {
        return /^jub-/.test(lib);
    });
};


function searchLibs() {
    var libs = [];
    var libdir;
    var match = /^(.*\/node_modules)\/jub.*/.exec(__filename);
    if(match) {
        libdir = match[1];
        libs = fs.readdirSync(libdir);
    }

    var localLibdir = pathModule.resolve('node_modules');
    if(libdir !== localLibdir && fs.existsSync(localLibdir)) {
        var localLibs = fs.readdirSync(localLibdir);
        libs = helper.unique(libs.concat(localLibs));
    }
    return libs;
}


helper.parseArgs = function(args) {
    var tasks = [];
    var excludePlugins = [];
    var jubfilePath;
    var helpFlag = false;
    var taskListFlag = false;

    for(var i = 0; i < args.length; i++) {
        var arg = args[i];

        if(arg === '-h' || arg === '--help') {
            helpFlag = true;
        } else if(arg === '-x' || arg === '--exclude') {
            i++;
            var plugins = args[i].split(',');
            for(var p = 0; p < plugins.length; p++) {
                var plug = plugins[p];
                if(plug.slice(0, 4) !== 'jub-') {
                    plug = 'jub-' + plug;
                }
                excludePlugins.push(plug);
            }
        } else if(arg === '-t' || arg === '-T' || arg === '--tasks') {
            taskListFlag = true;
        } else if(arg === '-f' || arg === '--jubfile') {
            i++;
            jubfilePath = args[i];
        } else {
            tasks.push(args[i]);
        }
    }

    return {
        tasks: tasks,
        excludePlugins: excludePlugins,
        jubfilePath: jubfilePath,
        helpFlag: helpFlag,
        taskListFlag: taskListFlag,
    };
};


helper.printHelp = function(options) {
    console.log(options);
};

// ----------------------------------------
// Shell commands helper

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
        if(err.code !== 'ENOENT') {
            throw err;
        }
        mkdirp(pathModule.dirname(dir));
        fs.mkdirSync(dir);
        return;
    }
    var err = new Error('EEXIST, file already exists \'' + dir + '\'');
    err.code = 'EEXIST';
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
        if(err.code !== 'ENOENT') { throw err; }
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
        if(err.code !== 'EEXIST') { throw err; }
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
    var srcfd = fs.openSync(src, 'r');
    var destfd = fs.openSync(dest, 'w');
    var bufsize = 8192;
    var buffer = new Buffer(bufsize);
    var readBytes = 0;

    try {
        while(true) {
            readBytes = fs.readSync(srcfd, buffer, 0, bufsize);
            if(readBytes === 0) {
                break;
            }
            fs.writeSync(destfd, buffer, 0, readBytes);
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
        if(err.code !== 'EEXIST') { throw err; }
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
