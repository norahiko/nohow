"use strict";

var jub = require("./jub.js");
var helper = require("./helper.js");
var logging = require("./logging.js");
var taskModule = require("./task.js");
var tempdir = require("./tempdir.js");
var tools = require("./tools.js");
var fs = require("fs");
var pathModule = require("path");


var HEADER = "Jub: Task runner for Node.";

var USAGE = "Usage\n" +
            "  jub [options] [taskName ...]\n\n" +

            "Options\n" +
            "  -f path, --jubfile path                input jubfile path.\n" +
            "  -h     , --help                        show this message\n" +
            "  -t     , --tasks                       print task names.\n" +
            "  -T     , --all-tasks                   print all task names.\n" +
            "  -x     , --exclude plugin[,plugin...]  prevent auto loading plugins.\n" +
            "           --version                     print Jub version.";

var MIN_USAGE = "Usage: jub [-f path | -t | -T | -h] [tasks...]";

exports.main = function() {
    var cl = new CommandLine(process.argv.slice(2));
    cl.parseArgs();

    if(cl.versionFlag) {
        console.log(jub.version.join("."));
        return;
    }
    if(cl.helpFlag) {
        console.log(HEADER);
        console.log("");
        console.log(USAGE);
        return;
    }

    cl.setup();

    if(cl.allTaskListFlag) {
        cl.printTasks(true);
        return;
    }
    if(cl.taskListFlag) {
        cl.printTasks(false);
        return;
    }

    if(cl.tasks.length === 0) {
        if("default" in taskModule.Task.all) {
            tools.before("default");
        } else {
            logging.error("Task name required.");
            console.error(MIN_USAGE);
            process.exit(1);
        }
    }

    taskModule.runMain(cl.tasks, mainErrorHandler);
};


function mainErrorHandler(mainTaskError, afterTaskError) {
    printTaskError(mainTaskError);
    printTaskError(afterTaskError);
    if(mainTaskError || afterTaskError) {
        process.exit(8);
    }
}


function printTaskError(err) {
    if(! err) { return; }

    var stack = err.stack;
    var info = helper.getTraceInfo(stack, 0);
    var idx = stack.indexOf("\n");
    var msg = stack.slice(0, idx);
    var stackTrace = stack.slice(idx + 1);

    logging.error(msg);
    printErroredSourceCode(info);
    console.error(stackTrace);
}


function printErroredSourceCode(info) {
    // skip if source is NativeModule
    if(/[\\/]/.test(info.src) === false) { return; }

    try {
        var source = fs.readFileSync(info.src, "utf8");
        var lines = source.split("\n");
        var line = lines[parseInt(info.line) - 1];
        console.error(line);
        var cursor = helper.spaces(parseInt(info.col) - 1) + "^";
        console.error(cursor);
    } catch(_) {
        // source has gone
    }
}


/**
 * CommandLine class
 */

function CommandLine(args) {
    this.args = args;
    this.tasks = [];
    this.excludePlugins = Object.create(null);
    this.jubfile = null;
    this.versionFlag = false;
    this.helpFlag = false;
    this.taskListFlag = false;
    this.allTaskListFlag = false;
}

exports.CommandLine = CommandLine;


CommandLine.prototype.parseArgs = function () {
    var args = this.args;
    for(var i = 0; i < args.length; i++) {
        var arg = args[i];
        var eq = args[i].indexOf("=");

        if(arg === "--version") {
            this.versionFlag = true;

        } else if(arg === "-h" || arg === "--help") {
            this.helpFlag = true;

        } else if(arg === "-f" || arg === "--jubfile") {
            i++;
            this.jubfile = args[i];

        } else if(arg === "-x" || arg === "--exclude") {
            i++;
            this.addExcludePlugins(args[i].split(","));

        } else if(arg === "-t" || arg === "--tasks") {
            this.taskListFlag = true;

        } else if(arg === "-T" || arg === "--all-tasks") {
            this.allTaskListFlag = true;

        } else if(arg[0] === "-") {
            logging.error("Unknown option '%s'", arg);
            process.exit(1);

        } else if(eq !== -1) {
            this.setEnv(arg, eq);

        } else {
            this.tasks.push(args[i]);
        }
    }
};


CommandLine.prototype.addExcludePlugins = function(plugins) {
    for(var i = 0; i < plugins.length; i++) {
        var plug = plugins[i];
        if(/^jub-/.test(plug) === false) {
            plug = "jub-" + plug;
        }
        this.excludePlugins[plug] = true;
    }
};


CommandLine.prototype.setup = function() {
    this.loadPackageJson();
    this.findJubfiles();
    this.addBuiltinTask();
    taskModule.nextMode(); // taskmode: builtin -> plugin
    tools._extendsNativeObject();

    var loader = new PluginLoader(this.excludePlugins);
    loader.load();

    taskModule.nextMode(); // taskmode: plugin -> user
    this.loadJubfile();
};


CommandLine.prototype.loadPackageJson = function() {
    try {
        jub.pkg = JSON.parse(tools.readFile("$root/package.json", "utf8"));
        jub.env.pkg = jub.pkg;
    } catch(_) {
        // Not found package.json or Syntax Error
    }
};


CommandLine.prototype.addBuiltinTask = function() {
    tools.task("clearTempfiles", function() {
        tempdir.clearTempfiles();
    });

    tools.after("_saveConfigFiles");
    tools.task("_saveConfigFiles", function() {
        tempdir.saveConfigFiles();
    });

    var server;
    tools.asyncTask("StaticServer", function(done) {
        server = tools.StaticServer({ logging: true, listenCallback: done });
    });

    tools.asyncTask("closeStaticServer", function(done) {
        if(server) {
            server.close(done);
            server = null;
        }
    });
};


CommandLine.prototype.findJubfiles = function() {
    if(this.jubfile) {
        jub.jubfilePaths = [pathModule.resolve(this.jubfile)];
    } else {
        jub.jubfilePaths = tools.glob("$root/jubfile*");
    }
};


CommandLine.prototype.printTasks = function(printBuiltinTasks) {
    if(printBuiltinTasks) {
        this.printTaskWithMode("Builtin task", taskModule.Task.BUILTIN);
        this.printTaskWithMode("Plugin task", taskModule.Task.PLUGIN);
    }
    this.printTaskWithMode("User task", taskModule.Task.USER);
};


CommandLine.prototype.printTaskWithMode = function(title, mode) {
    var allTasks = taskModule.Task.getAll();
    var tasks = allTasks.filter(function(task) {
        return task.mode === mode && task.name[0] !== "_";
    });
    if(tasks.length === 0) {
        return;
    }

    tasks.sort(function (a, b) { return a.name > b.name });
    console.log(title);
    tasks.forEach(function(task) {
        var line = "    " + task.name;
        if(task.description) {
            line += " " + helper.spaces(24 - line.length);
            line += task.description;
        }
        console.log(line);
    });

};


CommandLine.prototype.setEnv = function(pair, index) {
    var name = pair.slice(0, index);
    var value = pair.slice(index + 1);
    process.env[name] = value;
    jub.env[name] = value;
};


CommandLine.prototype.loadJubfile = function() {
    var filename = jub.jubfilePaths[0];
    if(filename === undefined) {
        return;
    }

    if(tools.exists(filename) === false) {
        logging.error("No jubfile found '%s'", (this.jubfile || filename));
        process.exit(1);
    }

    var jubfileHeader = this.generateJubfileHeader();
    var Module = require("module");
    var _wrap = Module.wrap;
    Module.wrap = function(script) {
        Module.wrap = _wrap;
        return _wrap(jubfileHeader + script);
    };

    try {
        jub.jubfile = require(filename);
    } finally {
        Module.wrap = _wrap;
    }
};


CommandLine.prototype.generateJubfileHeader = function() {
    var names = Object.keys(jub.tools);
    var header = "var jub=require('jub'), tools=jub.tools, ";

    var tools = [];
    names.forEach(function(name) {
        if(name[0] !== "_") {
            tools.push(name + "=tools." + name);
        }
    });
    header += tools.join(", ") + ";";
    header += " jub.jubfile=module.exports;";
    return header;
};


/**
 * PluginLoader class
 */

function PluginLoader(excludePlugins) {
    this.exclude = excludePlugins;
}


PluginLoader.prototype.load = function() {
    var exclude = this.exclude;
    this.searchPluginNames().forEach(function(name) {
        if(exclude[name] === undefined) {
            require(name);
        }
    });
};


PluginLoader.prototype.searchPluginNames = function() {
    var libs = tools.glob("$root/node_modules/*");
    var pdir = tools.expand("$0:dir:dir", __dirname);
    if(pathModule.basename(pdir) === "node_modules") {
        libs.push.apply(libs, tools.glob(pdir + "/*"));
    }

    return libs.filter(function(lib) {
        return /^jub-/.test(pathModule.basename(lib));
    });
};
