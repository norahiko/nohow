'use strict';

var commands = exports;
var pathModule = require('path');
var assert = require('assert');
var fs = require('fs');

var helper = require('./helper');
var lazylib = helper.lazylib;

commands.env = require('./rusk.js').env;
/*
 * Command trace
 */
commands.trace = function trace(/* messages */) {
    var dummy = {};
    Error.captureStackTrace(dummy);
    var stacks = dummy.stack.split('\n');
    var stackInfo = stacks[2].match(/\(.*\)$|at .*$/)[0].split(':');
    stackInfo[0] = pathModule.basename(stackInfo[0]);
    var args = ['(' + stackInfo.join(':') + ')'];
    args.push.apply(args, arguments);
    console.log.apply(console, args);
};

// e.g. expression = '$0:foo', '${varname:filter1:filter2}'
var expandExpression = /\$[\w_.]+(?::[\w_$]+)*|\${[\w_]+(?::[\w_$]+)*}/g;

/*
 * Command expand
 */
commands.expand = function expand(format /* ...args */) {
    assert(typeof format === 'string', 'rusk.expand: arguments[0] must be a String');

    if(format[0] === '"' || format[0] === '\'') {
        return format;
    }

    // replace '~' to HOME directory abs path
    if(format[0] === '~') {
        format = pathModule.join(commands.env.HOME, format.slice(1));
    }

    if(format.indexOf('$') === -1) {
        return format;
    }
    var args = [];
    if(1 < arguments.length) {
        args = Array.prototype.slice.call(arguments, 1);
    }

    return format.replace(expandExpression, function (exp) {
        // trim '$' and '${ }'
        exp = (exp[1] === '{') ? exp.slice(2, -1) : exp.slice(1);

        // extract value and filters from expression
        var filters = exp.split(':');
        var attrs = filters.shift().split('.');
        var varname = attrs.shift();
        var value;
        if(commands.reservedValue[varname]) {
            value = commands.reservedValue[varname]();
        } else if(helper.isDigit(varname)) {
            value = args[varname];
        } else {
            value = commands.env[varname];
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
            value = commands.expandFilter[filterName](value);
        });
        return value.toString();
    });
};

commands.reservedValue = {
    cwd: function() {
        return process.cwd();
    },
};

commands.expandFilter = {
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
commands.glob = function glob(patterns) {
    if(typeof patterns === 'string') {
        patterns = [patterns];
    }
    patterns = Array.prototype.map.call(patterns, commands.expand);
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

/*
 * Command exec
 */
commands.exec = function exec(command, options) {
    return commands.execBuf(command, options).toString();
};

/*
 * Command spawn
 */
commands.spawn = function spawn(file, args, options) {
    var result = commands.spawnBuf(file, args, options);
    result.stdout = result.stdout.toString();
    result.stderr = result.stderr.toString();
    return result;
};
