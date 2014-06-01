'use strict';

var builtins = exports;
var pathModule = require('path');
var assert = require('assert');
var fs = require('fs');

var helper = require('./helper');
var env = require('./rusk.js').env;
var tempdir = require('./tempdir.js');
var lazylib = helper.lazylib;

// e.g. expression = '$0:foo', '${varname:filter1:filter2}'
var expressionPattern = /\$[\w_.]+(?::[\w_$]+)*|\${[\w_]+(?::[\w_$]+)*}/g;

/*
 * Command trace
 */
builtins.trace = function trace(/* messages */) {
    var dummy = {};
    Error.captureStackTrace(dummy);
    var stacks = dummy.stack.split('\n');
    var stackInfo = stacks[2].match(/\(.*\)$|at .*$/)[0].split(':');
    stackInfo[0] = pathModule.basename(stackInfo[0]);
    var args = ['(' + stackInfo.join(':') + ')'];
    args.push.apply(args, arguments);
    console.log.apply(console, args);
};

/*
 * Command expand
 */
builtins.expand = function expand(format /* ...args */) {
    assert(typeof format === 'string', 'rusk.expand: arguments[0] must be a String');

    if(format[0] === '"' || format[0] === '\'') {
        return format;
    }

    // replace '~' to HOME directory abs path
    if(format[0] === '~') {
        format = pathModule.join(env.HOME, format.slice(1));
    }

    if(format.indexOf('$') === -1) {
        return format;
    }
    var args = [];
    if(1 < arguments.length) {
        args = Array.prototype.slice.call(arguments, 1);
    }

    return format.replace(expressionPattern, function (exp) {
        // trim '$' and '${ }'
        exp = (exp[1] === '{') ? exp.slice(2, -1) : exp.slice(1);

        // extract value and filters from expression
        var filters = exp.split(':');
        var attrs = filters.shift().split('.');
        var varname = attrs.shift();
        var value;
        if(builtins.reservedValue[varname]) {
            value = builtins.reservedValue[varname]();
        } else if(helper.isDigit(varname)) {
            value = args[varname];
        } else {
            value = env[varname];
        }
        if(value === undefined) {
            throw new Error('rusk.expand: \'$' + varname + '\' is not defined');
        }

        for(var i = 0; i < attrs.length; i++) {
            var attr = attrs[i];
            if(value[attr] === undefined) {
                var errorExpr = varname + '.' + attrs.slice(0, i+1).join('.');
                throw new Error('rusk.expand: \'$' + errorExpr + '\' is not defined');
            }
            value = value[attr];
        }

        // apply filter
        filters.forEach(function(filterName) {
            value = builtins.expandFilter[filterName](value);
        });
        return value.toString();
    });
};

builtins.reservedValue = {
    cwd: function() {
        return process.cwd();
    },
};

builtins.expandFilter = {
    abs: pathModule.resolve,
    base: pathModule.basename,
    ext: pathModule.extname,
    dir: pathModule.dirname,
    rmext: function(path) {
        var extLength = pathModule.extname(path).length;
        return extLength ? path.slice(0, -extLength) : path;
    },
};

/*
 * Command glob
 */
builtins.glob = function glob(patterns) {
    if(typeof patterns === 'string') {
        patterns = [patterns];
    }
    patterns = Array.prototype.map.call(patterns, builtins.expand);
    var paths = [];
    patterns.forEach(function(ptn) {
        if(/[[{?*]/.test(ptn)) {
            paths.push.apply(paths, lazylib.glob.sync(ptn));
        } else if(fs.existsSync(ptn)) {
            paths.push(ptn);
        }
    });
    return paths;
};

var glob = builtins.glob;

/*
 * Command ls
 */
builtins.ls = function ls(globpattern) {
    // ls() returns list files in current directory
    if(arguments.length === 0) {
        return fs.readdirSync('./');
    }
    var paths = glob(globpattern);

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

/*
 * Command root
 */
builtins.root = function root() {
    return env.root;
};

/*
 * Command cwd
 */
builtins.cwd = function cwd() {
    return process.cwd();
};

/*
 * Comamnd abs
 */
builtins.abspath = function abspath(path) {
    return pathModule.resolve(path);
};

/*
 * Command chdir
 */
builtins.chdir = function chdir(dirpath) {
    dirpath = builtins.expand(dirpath);
    process.chdir(dirpath);
};

/*
 * Command pushd
 */
builtins.pushd = function pushd(dirpath) {
    dirpath = builtins.expand(dirpath);
    dirStack.push(process.cwd());
    process.chdir(dirpath);
};

var dirStack = [];

/*
 * Command popd
 */
builtins.popd = function popd() {
    var dirpath = dirStack.pop();
    if(dirpath === undefined) {
        throw new Error('rusk.popd: directory stack empty');
    }
    process.chdir(dirpath);
};

/*
 * Command exists
 */
builtins.exists = function exists(path) {
    path = builtins.expand(path);
    return fs.existsSync(path);
};

/*
 * Command notExists
 */
builtins.notExists = function notExists(path) {
    return ! builtins.exists(path);
};


/*
 * Command mkdir
 */
builtins.mkdir = function mkdir(dirpath) {
    dirpath = builtins.expand(dirpath);
    helper.mkdirp(dirpath);
};

/*
 * Command remove
 */
builtins.remove = function remove(globpattern) {
    var paths = glob(globpattern);
    paths.forEach(fs.unlinkSync);
};

/*
 * Command removeRecursive
 */
builtins.removeRecursive = function removeRecursive(globpattern) {
    var paths = glob(globpattern);
    paths.forEach(helper.removeTree);
};

/*
 * Command move
 */
builtins.move = function move(globpattern, to) {
    to = builtins.expand(to);
    var paths = glob(globpattern);
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

/*
 * Command copy
 */
builtins.copy = function copy(globpattern, destPath) {
    destPath = builtins.expand(destPath);
    var paths = glob(globpattern);

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

builtins.writeFile = function writeFile(filename, contents) {
    filename = builtins.expand(filename);
    fs.writeFileSync(filename, contents);
};

/*
 * Command readFile
 */
builtins.readFile = function readFile(filename) {
    filename = builtins.expand(filename);
    return fs.readFileSync(filename).toString();
};

/*
 * Command edit
 */
builtins.edit = function edit(globpattern, editCallback) {
    assert(typeof editCallback === 'function', 'rusk.edit: arguments[1] must be a function');
    glob(globpattern).forEach(function(path) {
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
builtins.replace = function replace(globpattern, from, to) {
    assert(from instanceof RegExp, 'rusk.replace: arguments[1] must be a RegExp');
    assert(from.global, 'rusk.replace: RegExp needs global flag (for example: /foo/g )');
    var paths = glob(globpattern);
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
builtins.readFileBuffer = function readFileBuffer(filename) {
    filename = builtins.expand(filename);
    return fs.readFileSync(filename);
};

/*
 * Command concat
 */
builtins.concat = function concat(globpattern, sep) {
    var paths = glob(globpattern);
    sep = sep || '\n';
    var contents = paths.map(function(p) {
        return fs.readFileSync(p, 'utf8');
    });
    return contents.join(sep);
};

/*
 * Command concatBuffer
 */
builtins.concatBuffer = function concatBuffer(globpattern) {
    var paths = glob(globpattern);
    var contents = paths.map(function(p) {
        return fs.readFileSync(p);
    });
    return Buffer.concat(contents);
};

/*
 * Command tempfile
 */
builtins.tempfile = function tempfile(content) {
    return tempdir.createTempfile('temp', content);
};

/*
 * Command exec
 */
builtins.exec = function exec(command, options) {
    return builtins.execBuf(command, options).toString();
};

/*
 * Command spawn
 */
builtins.spawn = function spawn(file, args, options) {
    var result = builtins.spawnBuf(file, args, options);
    result.stdout = result.stdout.toString();
    result.stderr = result.stderr.toString();
    return result;
};
