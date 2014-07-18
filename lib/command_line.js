"use strict";

var helper = require("./helper.js");
var nohow = helper.lazylib.nohow;
var logging = helper.lazylib.logging;
var taskModule = helper.lazylib.taskModule;
var tempdir = helper.lazylib.tempdir;
var tools = helper.lazylib.tools;
var fs = require("fs");
var pathModule = require("path");

function emptyTask(done) { done && done(); }

var Task = taskModule.Task;

var HEADER = "Nohow: Task runner for Node.";

var USAGE = "Usage\n" +
            "  nohow [options] [taskName ...]\n\n" +

            "Options\n" +
            "  -f path, --file path                   input nohow file path.\n" +
            "  -h     , --help                        show this message\n" +
            "  -t     , --tasks                       print task names.\n" +
            "  -T     , --all-tasks                   print all task names.\n" +
            "  -x     , --exclude plugin[,plugin...]  prevent auto loading plugins.\n" +
            "           --version                     print Nohow version.";

var MIN_USAGE = "Usage: nohow [-f path | -t | -T | -h] [tasks...]";


exports.main = function() {
    var cl = new CommandLine(process.argv.slice(2));
    cl.parseArgs();

    if(cl.versionFlag) {
        console.log(nohow.version.join("."));
        return;
    }
    if(cl.helpFlag) {
        console.log(HEADER);
        console.log("");
        console.log(USAGE);
        return;
    }

    cl.setup();

    if(cl.taskListKeyword) {
        cl.taskSearch(cl.taskListKeyword);
        return;
    }
    if(cl.allTaskListFlag) {
        cl.printTasks(true);
        return;
    }
    if(cl.taskListFlag) {
        cl.printTasks(false);
        return;
    }

    if(cl.tasks.length === 0) {
        if("default" in Task.all) {
            tools.before("default");
        } else {
            logging.error("Task name required.");
            console.error(MIN_USAGE);
            process.exit(1);
        }
    }


    Task.get("__main").start(function(mainTaskError) {
        Task.get("__after").start(function(afterTaskError) {
            mainErrorHandler(mainTaskError, afterTaskError);
        });
    });

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
    } catch(err) {
        // source has gone
        console.error(err);
    }
}


/**
 * CommandLine class
 */

function CommandLine(args) {
    this.args = args;
    this.tasks = [];
    this.excludePlugins = Object.create(null);
    this.nohowFileName = null;
    this.versionFlag = false;
    this.helpFlag = false;
    this.taskListFlag = false;
    this.allTaskListFlag = false;
    this.taskListKeyword = null;
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

        } else if(arg === "-f" || arg === "--file") {
            i++;
            this.nohowFileName = args[i];

        } else if(arg === "-x" || arg === "--exclude") {
            i++;
            this.addExcludePlugins(args[i].split(","));

        } else if(arg === "-t" || arg === "--tasks") {
            this.taskListFlag = true;

        } else if(arg === "-T" || arg === "--all-tasks") {
            this.allTaskListFlag = true;
            if(args[i + 1] && args[i + 1][0] !== "-") {
                this.taskListKeyword = args[i + 1];
                i++;
            }

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
        if(/^nohow-/.test(plug) === false) {
            plug = "nohow-" + plug;
        }
        this.excludePlugins[plug] = true;
    }
};


CommandLine.prototype.setup = function() {
    this.loadPackageJson();
    this.findNohowFiles();
    this.addInternalTask();

    Task.mode = Task.PLUGIN;
    this.addBuiltinTask();
    extendsNativeObject();

    var loader = new PluginLoader(this.excludePlugins);
    loader.load();

    Task.mode = Task.USER;
    this.loadNohowFile();
};


CommandLine.prototype.loadPackageJson = function() {
    try {
        nohow.pkg = JSON.parse(tools.readFile("$ROOT/package.json", "utf8"));
        tools.env.pkg = nohow.pkg;
    } catch(_) {
        // Not found package.json or Syntax Error
    }
};



CommandLine.prototype.addInternalTask = function() {
    tools.asyncTask("__before", Task.beforeTaskList, emptyTask);
    tools.asyncTask("__main", ["__before"].concat(this.tasks), emptyTask);
    tools.asyncTask("__after", Task.afterTaskList, emptyTask);

    tools.after("_saveConfigFiles");
    tools.task("_saveConfigFiles", function() {
        tempdir.saveConfigFiles();
    });
};


CommandLine.prototype.addBuiltinTask = function() {
    tools.task("clearTempfiles", function() {
        tempdir.clearTempfiles();
    });


    var server;
    tools.asyncTask("StaticServer", function(done) {
        server = tools.StaticServer({ logging: true, callback: done });
    });

    tools.asyncTask("closeStaticServer", function(done) {
        if(server) {
            server.close(done);
            server = null;
        }
    });
};


CommandLine.prototype.findNohowFiles = function() {
    if(this.nohowFileName) {
        nohow.nohowFilePaths = [pathModule.resolve(this.nohowFileName)];
    } else {
        var paths = helper.readdirWithDirname(tools.env.ROOT);
        nohow.nohowFilePaths = paths.filter(function(path) {
             return /^nohow/i.test(pathModule.basename(path));
        });
    }
};


CommandLine.prototype.printTasks = function(printBuiltinTasks) {
    if(printBuiltinTasks) {
        this.printTasksByMode("Builtin task", Task.BUILTIN);
        this.printTasksByMode("Plugin task", Task.PLUGIN);
    }
    this.printTasksByMode("User task", Task.USER);
};


CommandLine.prototype.printTasksByMode = function(title, mode) {
    var allTasks = Task.getAll();
    var tasks = allTasks.filter(function(task) {
        return task.mode === mode && task.name[0] !== "_";
    });
    if(tasks.length === 0) {
        return;
    }

    tasks.sort(function (a, b) { return a.name > b.name });
    console.log(title);
    tasks.forEach(function(task) {
        printTask(task, "    ");
    });
};


CommandLine.prototype.taskSearch = function(keyword) {
    var regex = new RegExp(keyword, "i");
    var allTasks = Task.getAll();
    allTasks.sort(function (a, b) { return a.name > b.name });
    allTasks.forEach(function(task) {
        if(regex.test(task.name)) {
            printTask(task, "");
        }
    });
};


CommandLine.prototype.setEnv = function(pair, index) {
    var name = pair.slice(0, index);
    var value = pair.slice(index + 1);
    process.env[name] = value;
    tools.env[name] = value;
};


CommandLine.prototype.loadNohowFile = function() {
    var filename = nohow.nohowFilePaths[0];
    if(filename === undefined) {
        return;
    }

    if(tools.exists(filename) === false) {
        logging.error("No nohow file found '%s'", (this.nohowFileName || filename));
        process.exit(1);
    }

    var nohowHeader = this.generateNohowFileHeader();
    var Module = require("module");
    var _wrap = Module.wrap;
    Module.wrap = function(script) {
        Module.wrap = _wrap;
        return _wrap(nohowHeader + script);
    };
    nohow.nohowFile = require(filename);
};


CommandLine.prototype.generateNohowFileHeader = function() {
    var names = Object.keys(tools);
    var header = "var nohow=require('nohow'), tools=nohow.tools, ";

    var assign = [];
    names.forEach(function(name) {
        if(name[0] !== "_") {
            assign.push(name + "=tools." + name);
        }
    });
    header += assign.join(", ") + ";";
    header += " nohow.nohowFile=module.exports;";
    return header;
};


function printTask(task, indent) {
    var output = indent + task.name;
    if(task.description) {
        output += " " + helper.spaces(Math.max(1, 24 - output.length));
        output += task.description;
    }
    console.log(output);
}


function extendsNativeObject() {
    // > ["index.html", "style.css"].expandEach("$0:abs");
    // ["/current/dir/index.html", "/current/dir/style.css"]
    Object.defineProperty(Array.prototype, "expandEach", {
        configurable: true,
        writable: true,
        value: function expandEach(exp) {
            return this.map(function(item) {
                return tools.expand(exp, item);
            });
        },
    });

    Object.defineProperty(String.prototype, "save", {
        configurable: true,
        writable: true,
        value: function save(file) {
            tools.writeFile(file, this);
        },
    });

    Object.defineProperty(Buffer.prototype, "save", {
        configurable: true,
        writable: true,
        value: function save(file) {
            tools.writeFile(file, this);
        },
    });
}

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
    var libs = tools.glob("$ROOT/node_modules/*");
    var pdir = tools.expand("$0:dir:dir", __dirname);
    if(pathModule.basename(pdir) === "node_modules") {
        libs.push.apply(libs, tools.glob(pdir + "/*"));
    }

    return libs.filter(function(lib) {
        return /^nohow-/.test(pathModule.basename(lib));
    });
};
