var pathModule = require('path');
var assert = require('assert');
var fs = require('fs');
var helper = require('./helper');
var commands = require('./commands.js');
var tempdir = require('./tempdir.js');
/*
 * Command listdir
 */
commands.listdir = function listdir(globpattern) {
    // listdir() returns list files in current directory
    if(arguments.length === 0) {
        return fs.readdirSync('./');
    }
    var paths = commands.glob(globpattern);

    var files = [];
    var subfiles = [];
    // if file is directory, read the directory
    // if file is not exists, throw error
    paths.forEach(function(file) {
        if(fs.statSync(file).isDirectory()) {
            var subdir = helper.readdirWithDirname(file);
            for(var i = 0; i < subdir.length; i++) {
                subfiles.push(subdir[i]);
            }
        } else {
            files.push(file);
        }
    });
    return files.concat(subfiles);
};

commands.ls = commands.listdir; // alias

/*
 * Command root
 */
commands.root = function root() {
    return commands.env.root;
};

/*
 * Command cwd
 */
commands.cwd = function cwd() {
    return process.cwd();
};

/*
 * Comamnd abs
 */
commands.abspath = function abspath(path) {
    return pathModule.resolve(path);
};

/*
 * Command chdir
 */
commands.chdir = function chdir(dirpath) {
    dirpath = commands.expand(dirpath);
    process.chdir(dirpath);
};

commands.cd = commands.chdir; // alias

/*
 * Command pushd
 */
commands.pushd = function pushd(dirpath) {
    dirpath = commands.expand(dirpath);
    dirStack.push(process.cwd());
    process.chdir(dirpath);
};

var dirStack = [];

/*
 * Command popd
 */
commands.popd = function popd() {
    var dirpath = dirStack.pop();
    if(dirpath === undefined) {
        throw new Error('rusk.popd: directory stack empty');
    }
    process.chdir(dirpath);
};

/*
 * Command exists
 */
commands.exists = function exists(path) {
    path = commands.expand(path);
    return fs.existsSync(path);
};

/*
 * Command notExists
 */
commands.notExists = function notExists(path) {
    return ! commands.exists(path);
};


/*
 * Command mkdir
 */
commands.mkdir = function mkdir(dirpath) {
    dirpath = commands.expand(dirpath);
    helper.mkdirp(dirpath);
};

/*
 * Command remove
 */
commands.remove = function remove(globpattern) {
    var paths = commands.glob(globpattern);
    paths.forEach(fs.unlinkSync);
};

commands.rm = commands.remove; // alias

/*
 * Command removeRecursive
 */
commands.removeRecursive = function removeRecursive(globpattern) {
    var paths = commands.glob(globpattern);
    paths.forEach(helper.removeTree);
};

/*
 * Command move
 */
commands.move = function move(globpattern, to) {
    to = commands.expand(to);
    var paths = commands.glob(globpattern);
    if(paths.length === 0) {
        throw new Error('rusk.move: \'' + globpattern + '\' no such file or directory');
    } else if(paths.length === 1) {
        helper.move(paths[0], to);
    } else {
        try {
            assert(fs.statSync(to).isDirectory());
        } catch(_) {
            throw new Error('rusk.move: \'' + to + '\' is not a directory');
        }
        helper.moveInto(paths, to);
    }
};

commands.mv = commands.move; // alias



/*
 * Command copy
 */
commands.copy = function copy(globpattern, destPath) {
    destPath = commands.expand(destPath);
    var paths = commands.glob(globpattern);

    if(paths.length === 0) {
        throw new Error('rusk.copy: \'' + globpattern + '\' no such file or directory');
    }

    var stat = null;
    try {
        stat = fs.statSync(destPath);
    } catch(err) {
        if(err.code !== 'ENOENT') { throw err; }
    }
    var destIsDir = !!stat && stat.isDirectory();
    if(1 < paths.length && destIsDir === false) {
        throw new Error('rusk.copy: \'' + destPath + '\' is not a directory');
    }

    for(var i = 0; i < paths.length; i++) {
        var dest = destPath;
        var src = paths[i];
        if(destIsDir) {
            var basename = pathModule.basename(src);
            dest = pathModule.join(destPath, basename);
        }
        helper.copyAny(src, dest);
    }
};

commands.cp = commands.copy; // alias

commands.writeFile = function writeFile(filename, contents) {
    filename = commands.expand(filename);
    fs.writeFileSync(filename, contents);
};

/*
 * Command readFile
 */
commands.readFile = function readFile(filename) {
    filename = commands.expand(filename);
    return fs.readFileSync(filename).toString();
};

/*
 * Command edit
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

/*
 * Command replace
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


/*
 * Command readFileBuffer
 */
commands.readFileBuffer = function readFileBuffer(filename) {
    filename = commands.expand(filename);
    return fs.readFileSync(filename);
};

/*
 * Command concat
 */
commands.concat = function concat(globpattern, sep) {
    var paths = commands.glob(globpattern);
    sep = sep || '\n';
    var contents = paths.map(function(p) {
        return fs.readFileSync(p, 'utf8');
    });
    return contents.join(sep);
};

commands.cat = commands.concat; // alias

/*
 * Command concatBuffer
 */
commands.concatBuffer = function concatBuffer(globpattern) {
    var paths = commands.glob(globpattern);
    var contents = paths.map(function(p) {
        return fs.readFileSync(p);
    });
    return Buffer.concat(contents);
};

/*
 * Command tempfile
 */
commands.tempfile = function tempfile(content) {
    return tempdir.createTempfile('temp', content);
};
