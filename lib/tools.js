'use strict';

var tools = exports;
var helper = require('./helper');
var assert = require('assert');
var fs = require('fs');
var pathModule = require('path');

var lazylib = helper.lazylib;
tools.env = createEnv();


function createEnv() {
    var env = Object.create(process.env);
    if(process.env.root === undefined) {
        env.root = process.cwd();
    }
    if(process.env.PWD === undefined) {
        env.PWD = process.cwd();
    }
    if(process.env.TMPDIR === undefined) {
        env.TMPDIR = require('os').tmpdir();
    }
    if(process.env.TMP === undefined) {
        env.TMP = env.TMPDIR;
    }
    return env;
}


tools.trace = function trace(/* messages */) {
    var obj = {};
    Error.captureStackTrace(obj);
    var stacks = obj.stack.split('\n');
    var stackInfo = stacks[2].match(/\(.*\)$|at .*$/)[0].split(':');
    stackInfo[0] = pathModule.basename(stackInfo[0]);
    var args = ['(' + stackInfo.join(':') + ')'];
    args.push.apply(args, arguments);
    console.error.apply(console, args);
};


// e.g. expression = '$0', '${varName}' '$varName.attr.attr', '$varName.attr:filter1:filter2'
var expandExpression = /\$[\w_.]+(?::[\w_]+)*|\${[\w_.]+(?::[\w_]+)*}/g;


tools.expand = function expand(format /* ...args */) {
    assert(typeof format === 'string', 'jub.expand: arguments[0] must be a String');

    if(format[0] === '"' || format[0] === '\'') {
        return format;
    }

    // replace '~' to HOME directory abs path
    if(format[0] === '~') {
        format = pathModule.join(tools.env.HOME, format.slice(1));
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

        // extract envVar and filters from expression
        var filters = exp.split(':');
        var attrs = filters.shift().split('.');
        var varName = attrs.shift();
        var envVar;
        if(tools._reservedValues[varName]) {
            envVar = tools._reservedValues[varName]();
        } else if(args.hasOwnProperty(varName)) {
            envVar = args[varName];
        } else {
            envVar = tools.env[varName];
        }
        if(envVar === undefined) {
            throw new Error('jub.expand: \'$' + varName + '\' is not defined');
        }

        // acccess attribute of envVar
        for(var i = 0; i < attrs.length; i++) {
            envVar = envVar[attrs[i]];
            if(envVar === undefined) {
                var errorExpr = varName + '.' + attrs.slice(0, i + 1).join('.');
                throw new Error('jub.expand: \'$' + errorExpr + '\' is not defined');
            }
        }

        // apply filter
        for(i = 0; i < filters.length; i++) {
            envVar = tools._expandFilters[filters[i]](envVar);
        }
        return envVar.toString();
    });
};


tools._reservedValues = {
    cwd: function() {
        return process.cwd();
    },
};


tools._expandFilters = {
    abs: pathModule.resolve,
    base: pathModule.basename,
    ext: pathModule.extname,
    dir: pathModule.dirname,
    rmext: function(path) {
        var extLength = pathModule.extname(path).length;
        return extLength ? path.slice(0, -extLength) : path;
    },
    digit1: zeroFillX(1),
    digit2: zeroFillX(2),
    digit3: zeroFillX(3),
    digit4: zeroFillX(4),
    digit5: zeroFillX(5),
    digit6: zeroFillX(6),
    digit7: zeroFillX(7),
    digit8: zeroFillX(8),
};


function zeroFillX(len) {
    var zero = new Array(len).join('0');
    return function(num) {
        var sign = '';
        if(num < 0) {
            num = -num;
            sign = '-';
        }
        var digit = (num | 0).toString();
        if(digit.length < len) {
            return sign + (zero + digit).slice(-len);
        }
        return sign + digit;
    };
}


tools.glob = function glob(patterns) {
    if(typeof patterns === 'string') {
        patterns = [patterns];
    }
    patterns = Array.prototype.map.call(patterns, tools.expand);
    var paths = [];
    for(var i = 0; i < patterns.length; i++) {
        var ptn = patterns[i];
        if(/[[{?*]/.test(ptn)) {
            var matched = lazylib.glob.sync(ptn);
            for(var m = 0; m < matched.length; m++) {
                paths.push(matched[m]);
            }
        } else if(fs.existsSync(ptn)) {
            paths.push(ptn);
        }
    }
    return paths;
};


tools._extendsNativeObject = function() {
    if([].expandEach) {
        return;
    }

    // > ['index.html', 'style.css'].expandEach('$0:abs');
    // ['/current/dir/index.html', '/current/dir/style.css']
    Object.defineProperty(Array.prototype, 'expandEach', {
        configurable: true,
        writable: true,
        value: function expandEach(exp) {
            return this.map(function(item) {
                return tools.expand(exp, item);
            });
        },
    });

    Object.defineProperty(String.prototype, 'save', {
        configurable: true,
        writable: true,
        value: function save(file) {
            tools.writeFile(file, this);
        },
    });

    Object.defineProperty(Buffer.prototype, 'save', {
        configurable: true,
        writable: true,
        value: function save(file) {
            tools.writeFile(file, this);
        },
    });
};


tools.Watcher = function Watcher(pattern, depends, taskFunc) {
    return new lazylib.Watcher(pattern, depends, taskFunc);
};


tools.StaticServer = function StaticServer(options) {
    return lazylib.StaticServer(options);
};


tools.exec = function exec(command, options) {
    return lazylib.spawn.exec(command, options);
};


tools.spawn = function spawn(executable, args, options) {
    return lazylib.spawn.spawn(executable, args, options);
};
