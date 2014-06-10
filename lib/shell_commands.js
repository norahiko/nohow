'use strict';

var commands = require('./commands.js');
var helper = require('./helper');
var tempdir = require('./tempdir.js');
var assert = require('assert');
var fs = require('fs');
var pathModule = require('path');


commands.listdir = function listdir(globpattern) {
    // listdir() returns list files in current directory
    if(arguments.length === 0) {
        return fs.readdirSync('./');
    }

    var files = [];
    var subfiles = [];
    // if file is directory, read the directory
    // if file is not exists, throw error
    var paths = commands.glob(globpattern);
    paths.forEach(function(file) {
        if(fs.statSync(file).isDirectory()) {
            var sub = helper.readdirWithDirname(file);
            subfiles.push.apply(subfiles, sub);
        } else {
            files.push(file);
        }
    });

    if(files.length === 0 && subfiles.length === 0) {
        throw new Error('rusk.listdir: \'' + globpattern + '\' no such file or directory');
    }
    return files.concat(subfiles);
};


commands.ls = commands.listdir; // alias


commands.root = function root() {
    return commands.env.root;
};


commands.cwd = function cwd() {
    return process.cwd();
};


commands.abspath = function abspath(path) {
    return pathModule.resolve(path);
};


commands.chdir = function chdir(dirpath) {
    dirpath = commands.expand(dirpath);
    process.chdir(dirpath);
};


commands.cd = commands.chdir; // alias


commands.pushd = function pushd(dirpath) {
    dirpath = commands.expand(dirpath);
    dirStack.push(process.cwd());
    process.chdir(dirpath);
};

var dirStack = [];


commands.popd = function popd() {
    var dirpath = dirStack.pop();
    if(dirpath === undefined) {
        throw new Error('rusk.popd: directory stack empty');
    }
    process.chdir(dirpath);
};


commands.exists = function exists(path) {
    path = commands.expand(path);
    return fs.existsSync(path);
};


commands.notExists = function notExists(path) {
    return ! commands.exists(path);
};


commands.mkdir = function mkdir(dirpath) {
    dirpath = commands.expand(dirpath);
    helper.mkdirp(dirpath);
};


commands.remove = function remove(globpattern) {
    var paths = commands.glob(globpattern);
    paths.forEach(fs.unlinkSync);
};


commands.rm = commands.remove; // alias


commands.removeRecursive = function removeRecursive(globpattern) {
    var paths = commands.glob(globpattern);
    paths.forEach(helper.removeTree);
};


commands.move = function move(globpattern, destPath) {
    destPath = commands.expand(destPath);
    var paths = commands.glob(globpattern);
    if(paths.length === 0) {
        throw new Error('rusk.move: \'' + globpattern + '\' no such file or directory');
    } else if(paths.length === 1) {
        helper.move(paths[0], destPath);
    } else {
        try {
            assert(fs.statSync(destPath).isDirectory());
        } catch(_) {
            throw new Error('rusk.move: \'' + destPath + '\' is not a directory');
        }
        helper.moveInto(paths, destPath);
    }
};


commands.mv = commands.move; // alias


commands.copy = function copy(globpattern, destPath) {
    destPath = commands.expand(destPath);
    var srcPaths = commands.glob(globpattern);

    if(srcPaths.length === 0) {
        throw new Error('rusk.copy: \'' + globpattern + '\' no such file or directory');
    }

    var stat = null;
    try {
        stat = fs.statSync(destPath);
    } catch(err) {
        if(err.code !== 'ENOENT') { throw err; }
    }
    var destIsDir = !!stat && stat.isDirectory();

    if(1 < srcPaths.length && destIsDir === false) {
        throw new Error('rusk.copy: \'' + destPath + '\' is not a directory');
    }

    for(var i = 0; i < srcPaths.length; i++) {
        var src = srcPaths[i];
        var dest = destPath;
        if(destIsDir) {
            var basename = pathModule.basename(src);
            dest = pathModule.join(destPath, basename);
        }
        helper.copyAny(src, dest);
    }
};


commands.cp = commands.copy; // alias


commands.writeFile = function writeFile(file, content) {
    file = commands.expand(file);
    fs.writeFileSync(file, content);
};


commands.readFile = function readFile(file) {
    return commands.readFileBuffer(file).toString();
};


commands.readFileBuffer = function readFileBuffer(file) {
    file = commands.expand(file);
    return fs.readFileSync(file);
};


commands.append = function append(file, content) {
    file = commands.expand(file);
    var fd = fs.openSync(file, 'a');
    fs.writeSync(fd, content);
    fs.closeSync(fd);
};


commands.prepend = function prepend(file, content) {
    file = commands.expand(file);
    if(Buffer.isBuffer(content) === false) {
        content = new Buffer(content);
    }
    var originalContent = fs.readFileSync(file);
    var fd = fs.openSync(file, 'w');
    fs.writeSync(fd, content, 0, content.length);
    fs.writeSync(fd, originalContent, 0, originalContent.length);
    fs.closeSync(fd);
};


commands.replace = function replace(globpattern, from, to) {
    assert(from instanceof RegExp, 'rusk.replace: arguments[1] must be a RegExp');
    assert(from.global, 'rusk.replace: RegExp needs global flag (for example: /foo/g )');
    var paths = commands.glob(globpattern);
    paths.forEach(function(file) {
        var content = fs.readFileSync(file).toString();
        var newContent = content.replace(from, to);
        if(content !== newContent) {
            fs.writeFileSync(file, newContent);
        }
    });
};


commands.concat = function concat(globpattern, sep) {
    var paths = commands.glob(globpattern);
    sep = sep || '\n';
    var content = paths.map(function(p) {
        return fs.readFileSync(p, 'utf8');
    });
    if(content.length === 0) {
        throw new Error('rusk.concat: \'' + globpattern + '\' no such file or directory');
    }
    return content.join(sep);
};


commands.cat = commands.concat; // alias


commands.concatBuffer = function concatBuffer(globpattern) {
    var paths = commands.glob(globpattern);
    var content = paths.map(function(p) {
        return fs.readFileSync(p);
    });
    if(content.length === 0) {
        throw new Error('rusk.concatBuffer: \'' + globpattern + '\' no such file or directory');
    }
    return Buffer.concat(content);
};


commands.tempfile = function tempfile(content) {
    return tempdir.createTempfile('temp', content);
};


commands.executable = function executable(file) {
    file = commands.expand(file);
    var pathdirs = commands.env.PATH.split(pathModule.delimiter);
    for(var i = 0; i < pathdirs.length; i++) {
        var path = helper.joinPath(pathdirs[i], file);
        try {
            if(fs.statSync(path).mode & 64) {
                return true;
            }
        } catch(_) { }
    }
    return false;
};


commands.modified = function modfied(path) {
    path = commands.expand(path);
    path = pathModule.resolve(path);
    var mtime = fs.statSync(path).mtime.getTime();
    var modifiedData = tempdir.loadConfigFile('modified');
    var lastChecked = modifiedData[path] || 0;
    modifiedData[path] = Date.now();
    return lastChecked < mtime;
};
