var helper = require('./helper');
var commands = require('./commands.js');
var tempdir = require('./tempdir.js');
var assert = require('assert');
var fs = require('fs');
var pathModule = require('path');


/**
 * Command listdir
 * @param {String|String[]} globpattern
 * @returns {String[]}
 * @alias commands.ls
 */
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


/**
 * Command root
 */
commands.root = function root() {
    return commands.env.root;
};


/**
 * Command cwd
 */
commands.cwd = function cwd() {
    return process.cwd();
};


/**
 * Comamnd abs
 * @param {String} path
 * @returns {String}
 */
commands.abspath = function abspath(path) {
    return pathModule.resolve(path);
};


/**
 * Command chdir
 * @param {String} dirpath
 * @alias commands.cd
 */
commands.chdir = function chdir(dirpath) {
    dirpath = commands.expand(dirpath);
    process.chdir(dirpath);
};

commands.cd = commands.chdir; // alias


/**
 * Command pushd
 * @param {String} dirpath
 */
commands.pushd = function pushd(dirpath) {
    dirpath = commands.expand(dirpath);
    dirStack.push(process.cwd());
    process.chdir(dirpath);
};

/**
 * directory history for pushd and popd
 * @type {String[]}
 */
var dirStack = [];


/**
 * Command popd
 */
commands.popd = function popd() {
    var dirpath = dirStack.pop();
    if(dirpath === undefined) {
        throw new Error('rusk.popd: directory stack empty');
    }
    process.chdir(dirpath);
};


/**
 * Command exists
 * @param {String} path
 */
commands.exists = function exists(path) {
    path = commands.expand(path);
    return fs.existsSync(path);
};


/**
 * Command notExists
 * @param {String} path
 */
commands.notExists = function notExists(path) {
    return ! commands.exists(path);
};


/**
 * Command mkdir
 * @param {String} dirpath
 */
commands.mkdir = function mkdir(dirpath) {
    dirpath = commands.expand(dirpath);
    helper.mkdirp(dirpath);
};


/**
 * Command remove
 * @param {String|String[]} globpattern
 * @alias commands.rm
 */
commands.remove = function remove(globpattern) {
    var paths = commands.glob(globpattern);
    paths.forEach(fs.unlinkSync);
};

commands.rm = commands.remove; // alias


/**
 * Command removeRecursive
 * @param {String|String[]} globpattern
 */
commands.removeRecursive = function removeRecursive(globpattern) {
    var paths = commands.glob(globpattern);
    paths.forEach(helper.removeTree);
};


/**
 * Command move
 * @param {String|String[]} globpattern
 * @param {String} destPath
 * @alias commands.mv
 */
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


/**
 * Command copy
 * @param {String|String[]} globpattern
 * @param {String} destPath
 * @alias commands.cp
 */
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


/**
 * Command writeFile
 * @param {String} filename
 * @param {Buffer|string} contents
 */
commands.writeFile = function writeFile(filename, contents) {
    filename = commands.expand(filename);
    fs.writeFileSync(filename, contents);
};


/**
 * Command readFile
 * @param {String} filename
 * @returns {String}
 */
commands.readFile = function readFile(filename) {
    return commands.readFileBuffer(filename).toString();
};


/**
 * Command readFileBuffer
 * @param {String} filename
 * @returns {Buffer}
 */
commands.readFileBuffer = function readFileBuffer(filename) {
    filename = commands.expand(filename);
    return fs.readFileSync(filename);
};


/**
 * Command edit
 * @param {String|String[]} globpattern
 * @param {Function} editCallback
 */
commands.edit = function edit(globpattern, editCallback) {
    assert(typeof editCallback === 'function', 'rusk.edit: arguments[1] must be a function');
    commands.glob(globpattern).forEach(function(path) {
        path = pathModule.resolve(path);
        var contents = fs.readFileSync(path).toString();
        var newContents = editCallback(path, contents);
        if(typeof newContents === 'string' && contents !== newContents) {
            fs.writeFileSync(path, newContents);
        }
    });
};


/**
 * Command replace
 * @param {String|String[]} globpattern
 * @param {RegExp} from
 * @param {Function|string} to
 */
commands.replace = function replace(globpattern, from, to) {
    assert(from instanceof RegExp, 'rusk.replace: arguments[1] must be a RegExp');
    assert(from.global, 'rusk.replace: RegExp needs global flag (for example: /foo/g )');
    var paths = commands.glob(globpattern);
    paths.forEach(function(filename) {
        var contents = fs.readFileSync(filename).toString();
        var newContents = contents.replace(from, to);
        if(contents !== newContents) {
            fs.writeFileSync(filename, newContents);
        }
    });
};


/**
 * Command concat
 * @param {String|String[]} globpattern
 * @param {string=} sep
 * @returns {String}
 * @alias commands.cat
 */
commands.concat = function concat(globpattern, sep) {
    var paths = commands.glob(globpattern);
    sep = sep || '\n';
    var contents = paths.map(function(p) {
        return fs.readFileSync(p, 'utf8');
    });
    if(contents.length === 0) {
        throw new Error('rusk.concat: \'' + globpattern + '\' no such file or directory');
    }
    return contents.join(sep);
};

commands.cat = commands.concat; // alias


/**
 * Command concatBuffer
 * @param {String|String[]} globpattern
 * @returns {Buffer}
 */
commands.concatBuffer = function concatBuffer(globpattern) {
    var paths = commands.glob(globpattern);
    var contents = paths.map(function(p) {
        return fs.readFileSync(p);
    });
    if(contents.length === 0) {
        throw new Error('rusk.concatBuffer: \'' + globpattern + '\' no such file or directory');
    }
    return Buffer.concat(contents);
};


/**
 * Command tempfile
 * @param {String} content
 * @returns {String} - tempfile abs path
 */
commands.tempfile = function tempfile(content) {
    return tempdir.createTempfile('temp', content);
};


/**
 * Command executable
 * @param {String} filename
 * @returns {Boolean}
 */
commands.executable = function executable(filename) {
    filename = commands.expand(filename);
    var pathdirs = commands.env.PATH.split(pathModule.delimiter);
    for(var i = 0; i < pathdirs.length; i++) {
        var path = helper.joinPath(pathdirs[i], filename);
        try {
            if(fs.statSync(path).mode & 64) {
                return true;
            }
        } catch(_) { }
    }
    return false;
};


/**
 * @param {String} path
 * @returns {Boolean}
 */
commands.modified = function modfied(path) {
    path = commands.expand(path);
    path = pathModule.resolve(path);
    var mtime = fs.statSync(path).mtime.getTime();
    var modifiedData = tempdir.loadConfigFile('modified');
    var lastChecked = modifiedData[path] || 0;
    modifiedData[path] = Date.now();
    return lastChecked < mtime;
};
