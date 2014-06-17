'use strict';

var tools = require('./tools.js');
var helper = require('./helper');
var tempdir = require('./tempdir.js');
var assert = require('assert');
var fs = require('fs');
var pathModule = require('path');


tools.listdir = function listdir(globpattern) {
    // listdir() returns list files in current directory
    if(arguments.length === 0) {
        return fs.readdirSync('./');
    }

    var files = [];
    var subfiles = [];
    // if file is directory, read the directory
    // if file is not exists, throw error
    var paths = tools.glob(globpattern);
    paths.forEach(function(file) {
        if(fs.statSync(file).isDirectory()) {
            var sub = helper.readdirWithDirname(file);
            subfiles.push.apply(subfiles, sub);
        } else {
            files.push(file);
        }
    });

    if(files.length === 0 && subfiles.length === 0) {
        throw new Error('jub.listdir: \'' + globpattern + '\' no such file or directory');
    }
    return files.concat(subfiles);
};


tools.ls = tools.listdir; // alias


tools.root = function root() {
    return tools.env.root;
};


tools.cwd = function cwd() {
    return process.cwd();
};


tools.abspath = function abspath(path) {
    return pathModule.resolve(path);
};


tools.chdir = function chdir(dirpath) {
    dirpath = tools.expand(dirpath);
    process.chdir(dirpath);
};


tools.cd = tools.chdir; // alias


tools.pushd = function pushd(dirpath) {
    dirpath = tools.expand(dirpath);
    dirStack.push(process.cwd());
    process.chdir(dirpath);
};

var dirStack = [];


tools.popd = function popd() {
    var dirpath = dirStack.pop();
    if(dirpath === undefined) {
        throw new Error('jub.popd: directory stack empty');
    }
    process.chdir(dirpath);
};


tools.exists = function exists(path) {
    path = tools.expand(path);
    return fs.existsSync(path);
};


tools.notExists = function notExists(path) {
    return ! tools.exists(path);
};


tools.mkdir = function mkdir(dirpath) {
    dirpath = tools.expand(dirpath);
    helper.mkdirp(dirpath);
};


tools.remove = function remove(globpattern) {
    var paths = tools.glob(globpattern);
    paths.forEach(fs.unlinkSync);
};


tools.rm = tools.remove; // alias


tools.removeRecursive = function removeRecursive(globpattern) {
    var paths = tools.glob(globpattern);
    paths.forEach(helper.removeTree);
};


tools.move = function move(globpattern, destPath) {
    destPath = tools.expand(destPath);
    var paths = tools.glob(globpattern);
    if(paths.length === 0) {
        throw new Error('jub.move: \'' + globpattern + '\' no such file or directory');
    } else if(paths.length === 1) {
        helper.move(paths[0], destPath);
    } else {
        try {
            assert(fs.statSync(destPath).isDirectory());
        } catch(_) {
            throw new Error('jub.move: \'' + destPath + '\' is not a directory');
        }
        helper.moveInto(paths, destPath);
    }
};


tools.mv = tools.move; // alias


tools.copy = function copy(globpattern, destPath) {
    destPath = tools.expand(destPath);
    var srcPaths = tools.glob(globpattern);

    if(srcPaths.length === 0) {
        throw new Error('jub.copy: \'' + globpattern + '\' no such file or directory');
    }

    var stat = null;
    try {
        stat = fs.statSync(destPath);
    } catch(err) {
        if(err.code !== 'ENOENT') { throw err; }
    }
    var destIsDir = !!stat && stat.isDirectory();

    if(1 < srcPaths.length && destIsDir === false) {
        throw new Error('jub.copy: \'' + destPath + '\' is not a directory');
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


tools.cp = tools.copy; // alias


tools.writeFile = function writeFile(file, content) {
    file = tools.expand(file);
    fs.writeFileSync(file, content);
};


tools.readFile = function readFile(file) {
    return tools.readFileBuffer(file).toString();
};


tools.readFileBuffer = function readFileBuffer(file) {
    file = tools.expand(file);
    return fs.readFileSync(file);
};


tools.append = function append(file, content) {
    file = tools.expand(file);
    var fd = fs.openSync(file, 'a');
    fs.writeSync(fd, content);
    fs.closeSync(fd);
};


tools.prepend = function prepend(file, content) {
    file = tools.expand(file);
    if(Buffer.isBuffer(content) === false) {
        content = new Buffer(content);
    }
    var originalContent = fs.readFileSync(file);
    var fd = fs.openSync(file, 'w');
    fs.writeSync(fd, content, 0, content.length);
    fs.writeSync(fd, originalContent, 0, originalContent.length);
    fs.closeSync(fd);
};


tools.replace = function replace(globpattern, from, to) {
    assert(from instanceof RegExp, 'jub.replace: arguments[1] must be a RegExp');
    assert(from.global, 'jub.replace: RegExp needs global flag (for example: /foo/g )');
    var paths = tools.glob(globpattern);
    paths.forEach(function(file) {
        var content = fs.readFileSync(file).toString();
        var newContent = content.replace(from, to);
        if(content !== newContent) {
            fs.writeFileSync(file, newContent);
        }
    });
};


tools.concat = function concat(globpattern, sep) {
    var paths = tools.glob(globpattern);
    sep = sep || '\n';
    var content = paths.map(function(p) {
        return fs.readFileSync(p, 'utf8');
    });
    if(content.length === 0) {
        throw new Error('jub.concat: \'' + globpattern + '\' no such file or directory');
    }
    return content.join(sep);
};


tools.cat = tools.concat; // alias


tools.concatBuffer = function concatBuffer(globpattern) {
    var paths = tools.glob(globpattern);
    var content = paths.map(function(p) {
        return fs.readFileSync(p);
    });
    if(content.length === 0) {
        throw new Error('jub.concatBuffer: \'' + globpattern + '\' no such file or directory');
    }
    return Buffer.concat(content);
};


tools.tempfile = function tempfile(content) {
    return tempdir.createTempfile('temp', content);
};


tools.executable = function executable(file) {
    file = tools.expand(file);
    var pathdirs = tools.env.PATH.split(pathModule.delimiter);
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


tools.modified = function modfied(path) {
    path = tools.expand(path);
    path = pathModule.resolve(path);
    var mtime = fs.statSync(path).mtime.getTime();
    var modifiedData = tempdir.loadConfigFile('modified');
    var lastChecked = modifiedData[path] || 0;
    modifiedData[path] = Date.now();
    return lastChecked < mtime;
};
