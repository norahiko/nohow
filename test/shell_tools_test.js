var fs = require("fs");
var nohow = require("../lib/nohow.js");
var taskModule = require("../lib/task.js");

var assert = require("chai").assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
var env = nohow.env;
var root = process.cwd();
env.TMPDIR = env.root;
//console.log(env.TMPDIR);


suite("Change directory nohow:", function() {
    setup(function () {
        process.chdir(root);
    });

    test("chdir", function () {
        nohow.chdir("~");
        equal(process.cwd(), env.HOME);
    });

    test("pushd", function() {
        nohow.pushd("test");
        assert.notEqual(process.cwd(), root);
        nohow.popd();
        equal(process.cwd(), root);
    });
});


suite("Shell nohow:", function() {
    env.main = "lib/main.txt";
    env.util = "lib/util.txt";
    var testdir = "test/data";

    setup(function() {
        /*
        create test files

        test
        └── data (current directory)
            ├── TESTDATA.txt
            ├── bin
            │   └── app
            └── lib
                ├── linkmain  -> main.txt
                ├── main.txt
                └── util.txt
        */
        process.chdir(root);
        nohow.removeRecursive("test/data");
        fs.mkdirSync(testdir);
        process.chdir(testdir);
        fs.writeFileSync("TESTDATA.txt", "testdata");
        // bin
        fs.mkdirSync("bin");
        fs.writeFileSync("bin/app", "app");
        // lib
        fs.mkdirSync("lib");
        fs.writeFileSync("lib/main.txt", "main");
        fs.writeFileSync("lib/util.txt", "util");
        fs.symlinkSync("main.txt", "lib/linkmain");
        taskModule.reset();
    });


    teardown(function () {
        process.chdir(root);
        taskModule.reset();
    });


    test("listdir", function() {
        deepEqual(nohow.listdir(), ["TESTDATA.txt", "bin", "lib"]);
        assert.notDeepEqual(nohow.ls("~"), []);
        deepEqual(nohow.ls("~"), nohow.ls("$HOME"));
        deepEqual(
            nohow.ls("*"),
            ["TESTDATA.txt", "bin/app", "lib/linkmain", "lib/main.txt", "lib/util.txt"]
        );

        assert.throws(function() {
            nohow.ls(["*.foo", "*.bar"]);
        }, "nohow.listdir");
    });


    test("glob", function () {
        deepEqual(
            nohow.glob("**/*.txt"),
            ["TESTDATA.txt", "lib/main.txt", "lib/util.txt"]
        );
        deepEqual(
            nohow.glob("**/cat.jpg"),
            []
        );
        deepEqual(
            nohow.glob(["bin/*", "TESTDATA.*"]),
            ["bin/app", "TESTDATA.txt"]
        );
        nohow.glob(1);
    });


    test("mkdir", function() {
        nohow.mkdir("newdir");
        nohow.mkdir("newdir"); // not throws Error
        assert(fs.statSync("newdir").isDirectory());

        nohow.mkdir("a/b/c/d/e");
        assert(fs.statSync("a/b/c/d/e").isDirectory());

        assert.throws(function() {
            // not enough arguments
            nohow.mkdir();
        }, "nohow.expand");

        assert.throws(function() {
            // already a file exists (not directory)
            nohow.mkdir("TESTDATA.txt");
        }, "EEXIST");
    });


    test("move", function() {
        // move file
        nohow.move("$main", "moved.txt");
        equal(fs.readFileSync("moved.txt", "utf8"), "main");
        assert(nohow.notExists("$main"));
        // move file into directory
        nohow.move("moved.txt", "bin");
        equal(fs.readFileSync("bin/moved.txt", "utf8"), "main");
        assert(nohow.notExists("moved.txt"));
        // move directory
        nohow.move("bin", "lib");
        equal(fs.readFileSync("lib/bin/moved.txt", "utf8"), "main");
        assert(nohow.notExists("bin"));

        assert.throws(function() {
            // not enough arguments
            nohow.move("TESTDATA.txt");
        }, "nohow.expand");

        assert.throws(function () {
            // source is not exists
            nohow.move("not_exists_file", "foo");
        }, "nohow.move");

        assert.throws(function () {
            // move current directory
            nohow.move("./", "lib");
        }, "EBUSY");
        assert.throws(function () {
            // move directory into self
            nohow.move("lib", "lib");
        }, "EINVAL");
    });


    test("move files", function() {
        nohow.move("lib/*.txt", "bin");
        deepEqual(fs.readdirSync("bin"), ["app", "main.txt", "util.txt"]);
    });


    test("copy", function() {
        nohow.copy("$main", "lib/copy.txt");
        equal(nohow.readFile("lib/copy.txt", "utf8"), "main");
        nohow.copy("lib", "copylib");
        equal(nohow.readFile("copylib/main.txt", "utf8"), "main");
        assert(nohow.exists("$main"));
        assert(nohow.exists("$util"));

        nohow.copy("lib", "copylib");
        equal(nohow.readFile("copylib/lib/main.txt", "utf8"), "main");

        assert.throws(function() {
            // not enough arguments
            nohow.copy("TESTDATA.txt");
        }, "nohow.expand");

        assert.throws(function() {
            // copy directory to file
            nohow.copy("lib", "TESTDATA.txt");
        }, "ENOTDIR");
    });


    test("copy link", function() {
        fs.mkdirSync("pack");
        fs.symlinkSync("lib", "linkdir");

        nohow.copy(["bin", "lib", "linkdir"], "pack");
        assert(fs.lstatSync("pack/lib/linkmain").isSymbolicLink());
        equal(fs.readFileSync("pack/lib/linkmain", "utf8"), "main");

        assert(fs.lstatSync("pack/linkdir").isSymbolicLink());
        equal(fs.readFileSync("pack/linkdir/main.txt", "utf8"), "main");

        // replace link
        nohow.copy("linkdir", "lib/linkmain");
        equal(fs.readlinkSync("lib/linkmain"), "lib");
    });


    test("copy files", function() {
        nohow.copy(["$main", "$util"], "bin");
        equal(nohow.readFile("bin/main.txt").toString(), "main");
        equal(nohow.readFile("bin/util.txt").toString(), "util");
    });


    test("remove", function() {
        nohow.remove("lib/main.txt");
        assert(fs.existsSync("lib/main.txt") === false);

        assert.doesNotThrow(function() {
            nohow.remove("not_exists_file");
        });

        assert.throws(function() {
            // cannot remove directory
            nohow.remove("lib");
        }, "EISDIR");
    });


    test("removeRecursive", function() {
        nohow.removeRecursive("lib");
        assert(fs.existsSync("lib") === false);

        assert.doesNotThrow(function() {
            nohow.removeRecursive("not_exists_dir");
        });
    });


    test("concat", function() {
        equal(nohow.concat(["$main", "$util"], "\n").toString(), "main\nutil");
        equal(nohow.concat(["$main", "$util"], "\n-----\n").toString(), "main\n-----\nutil");

        assert.throws(function() {
            nohow.concat(["not_exists_file.*"]);
        }, "nohow.concat");
    });


    test("append", function() {
        nohow.append("$main", "1");
        nohow.append("$main", "2");
        equal(nohow.readFile("$main").toString(), "main12");
    });


    test("prepend", function() {
        nohow.prepend("$main", "2");
        nohow.prepend("$main", "1");
        equal(nohow.readFile("$main").toString(), "12main");
    });


    test("replace", function() {
        var contents = [];
        nohow.replace("TESTDATA.txt", /.+/g, function(match) {
            contents.push(match);
            return "replaced";
        });

        nohow.replace("TESTDATA.txt", /replaced/g, function (match) {
            contents.push(match);
            return "testdata";
        });
        deepEqual(contents, ["testdata", "replaced"]);
    });


    test("tempfile", function() {
        var tempfile = nohow.tempfile("temp");
        equal(nohow.readFile(tempfile, "utf8"), "temp");
    });


    test("modified", function(done) {
        equal(nohow.modified("*/*.txt"), true);
        equal(nohow.modified("*/*.txt"), false);

        if(process.argv.indexOf("--watch") === -1) {
            setTimeout(function() {
                nohow.writeFile("$main", "changed");
                equal(nohow.modified("$main"), true);
                done();
            }, 1000);
        } else {
            done();
        }
    });


    test("watch", function(done) {
        var watcher = nohow.watch("lib/*.txt", function() {
            watcher.close();
            var modified = watcher.getModifiedFiles();

            equal(modified.length, 2);
            equal(modified[0].charAt(0), "/");
            equal(modified[0].slice(-12), "lib/main.txt");
            equal(modified[1].slice(-12), "lib/util.txt");
            equal(watcher.getModifiedFiles().length, 0);
            done();
        });

        equal(watcher.files.length, 2);

        nohow.append("lib/main.txt", "append text");
        nohow.append("lib/util.txt", "append text");
    });


    test("watch error", function() {
        assert.throws(function () {
            nohow.watch("not_exists_file", function() {});
        }, "nohow.Watcher");
    });
});
