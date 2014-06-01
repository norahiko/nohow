'use strict';

Error.stackTraceLimit = 7;

var rusk = require('../lib/rusk.js');
var pathModule = require('path');
var fs = require('fs');
var chai = require('chai');

var assert = chai.assert;
var equal = assert.strictEqual;
var notEqual = assert.notStrictEqual;
var deepEqual = assert.deepEqual;
var env = rusk.env;

var root = process.cwd();


suite('Expand command:', function () {
    env.key = 'value';
    env.file = 'dir/file.js';
    env.object = {key: [1, 2, ['piyo']]};

    var _cwd = process.cwd;

    setup(function() {
        process.cwd = function() {
            return '/test';
        };
    });

    teardown(function() {
        process.cwd = _cwd;
    });

    test('expand env', function () {
        equal(rusk.expand('$key'), 'value');
        equal(rusk.expand('${key}'), 'value');
        equal(rusk.expand('/a/$key/b'), '/a/value/b');
        equal(rusk.expand('$cwd'), '/test');
        equal(rusk.expand('$file'), 'dir/file.js');
        equal(rusk.expand('~'), process.env.HOME);
    });

    test('expand attributes', function() {
        equal(rusk.expand('$file.length'), '11');
        equal(rusk.expand('$object.key.2.0'), 'piyo');
    });

    test('expand filter', function() {
        if(process.platform !== 'win32') {
            equal(rusk.expand('$file:abs'), '/test/dir/file.js');
            equal(rusk.expand('${file:abs}'), '/test/dir/file.js');
        }
        equal(rusk.expand('$file:dir'), 'dir');
        equal(rusk.expand('$file:base'), 'file.js');
        equal(rusk.expand('$file:rmext'), 'dir/file');
        equal(rusk.expand('$file:base:rmext'), 'file');
    });

    test('expand arguments', function() {
        equal(rusk.expand('Hello, $0', 'RuskJS'), 'Hello, RuskJS');
        equal(rusk.expand('$0$1 is not $0', 'Java', 'Script'), 'JavaScript is not Java');
    });

    test('not expanded', function () {
        equal(rusk.expand('${key'), '${key');

    });

    test('expand error', function() {
        assert.throws(function() {
            rusk.expand('$undefined');
        });

        assert.throws(function() {
            rusk.expand('$0');
        });

        assert.throws(function() {
            rusk.expand('$1', 'foo');
        });

        assert.throws(function() {
            rusk.expand('$object.undefined');
        });

        assert.throws(function() {
            rusk.expand('$0:undefined_filter', 'value');
        });
    });
});


suite('Misc command:', function() {
    setup(function () {
        process.chdir(root);
    });

    test('defined', function() {
        for(var name in rusk.commands) {
            assert.isDefined(rusk.commands[name], 'commands.' + name + ' is undefined');
        }
    });

    test('trace', function() {
        var actual;
        var log = console.log;
        try {
            console.log = function() {
                actual = arguments;
            };
            rusk.trace('');
        } finally {
            console.log = log;
        }

        equal(actual.length, 2);
        assert(/command_test\.js/.test(actual[0]));
    });

    test('chdir', function () {
        rusk.chdir('~');
        equal(process.cwd(), env.HOME);
    });

    test('pushd', function() {
        rusk.pushd('test');
        notEqual(process.cwd(), root);
        rusk.popd();
        equal(process.cwd(), root);
    });

    test('tempfile', function() {
        var tempfile = rusk.tempfile('temp');
        equal(fs.readFileSync(tempfile).toString(), 'temp');
    });
});

suite('Filesystem manipulate command:', function() {
    env.main = 'lib/main.txt';
    env.util = 'lib/util.txt';
    var testdir = 'test/data';

    setup(function() {
        /*
        create testfiles
        cwd == test/data

        test
        └── data
            ├── TESTDATA.txt
            ├── bin
            │   └── app
            └── lib
                ├── linkmain  -> main.txt
                ├── main.txt
                └── util.txt
        */
        rusk.removeRecursive('test/data');
        assert(pathModule.basename(root) === 'rusk');
        fs.mkdirSync(testdir);
        process.chdir(testdir);
        fs.writeFileSync('TESTDATA.txt', 'testdata');
        // bin
        fs.mkdirSync('bin');
        fs.writeFileSync('bin/app', 'app');
        // lib
        fs.mkdirSync('lib');
        fs.writeFileSync('lib/main.txt', 'main');
        fs.writeFileSync('lib/util.txt', 'util');
        fs.symlinkSync('main.txt', 'lib/linkmain');
    });

    teardown(function () {
        process.chdir(root);
    });

    test('ls', function() {
        deepEqual(rusk.ls(), ['TESTDATA.txt', 'bin', 'lib']);
        notEqual(rusk.ls('~'), []);
        deepEqual(rusk.ls('~'), rusk.ls('$HOME'));
        deepEqual(
            rusk.ls('*'),
            ['TESTDATA.txt', 'bin/app', 'lib/linkmain', 'lib/main.txt', 'lib/util.txt']
        );
    });

    test('glob', function () {
        deepEqual(
            rusk.glob('**/*.txt'),
            ['TESTDATA.txt', 'lib/main.txt', 'lib/util.txt']
        );
        deepEqual(
            rusk.glob('**/cat.jpg'),
            []
        );
        deepEqual(
            rusk.glob(['bin/*', 'TESTDATA.*']),
            ['bin/app', 'TESTDATA.txt']
        );
        rusk.glob(1);
    });

    test('mkdir', function() {
        rusk.mkdir('newdir');
        rusk.mkdir('newdir'); // not throws Error
        assert(fs.statSync('newdir').isDirectory());
    });

    test('move', function() {
        // move file
        rusk.move('$main', 'moved.txt');
        equal(fs.readFileSync('moved.txt', 'utf8'), 'main');
        assert(rusk.notExists('$main'));
        // move file into directory
        rusk.move('moved.txt', 'bin');
        equal(fs.readFileSync('bin/moved.txt', 'utf8'), 'main');
        assert(rusk.notExists('moved.txt'));
        // move directory
        rusk.move('bin', 'lib');
        equal(fs.readFileSync('lib/bin/moved.txt', 'utf8'), 'main');
        assert(rusk.notExists('bin'));

        assert.throws(function () {
            rusk.move('not_a_file', 'foo');
        });
        assert.throws(function () {
            rusk.move('./', 'lib');
        });
        assert.throws(function () {
            rusk.move('lib', 'lib');
        });
    });

    test('move files', function() {
        rusk.move('lib/*.txt', 'bin');
        deepEqual(fs.readdirSync('bin'), ['app', 'main.txt', 'util.txt']);
    });

    test('copy', function() {
        rusk.copy('$main', 'lib/copy.txt');
        equal(rusk.readFile('lib/copy.txt'), 'main');
        rusk.copy('lib', 'copylib');
        equal(rusk.readFile('copylib/main.txt'), 'main');
        assert(rusk.exists('$main'));
        assert(rusk.exists('$util'));

        rusk.copy('lib', 'copylib');
        equal(rusk.readFile('copylib/lib/main.txt'), 'main');
    });

    test('copy link', function() {
        fs.mkdirSync('pack');
        fs.symlinkSync('lib', 'linkdir');

        rusk.copy(['bin', 'lib', 'linkdir'], 'pack');
        assert(fs.lstatSync('pack/lib/linkmain').isSymbolicLink());
        equal(fs.readFileSync('pack/lib/linkmain', 'utf8'), 'main');

        assert(fs.lstatSync('pack/linkdir').isSymbolicLink());
        equal(fs.readFileSync('pack/linkdir/main.txt', 'utf8'), 'main');
    });

    test('copy files', function() {
        rusk.copy(['$main', '$util'], 'bin');
        equal(rusk.readFile('bin/main.txt'), 'main');
        equal(rusk.readFile('bin/util.txt'), 'util');
    });

    test('remove', function() {
        assert.doesNotThrow(function () {
            fs.writeFileSync('newfile', 'new');
            rusk.remove('newfile');
            rusk.remove('not_exists_file');
        });
    });

    test('removeRecursive', function() {
        fs.mkdirSync('a_dir');
        fs.writeFileSync('a_dir/newfile', 'new');
        rusk.removeRecursive('a_dir');
        assert(fs.existsSync('a_dir') === false);
    });

    test('concat', function() {
        equal(rusk.concat(['$main', '$util']), 'main\nutil');
        equal(rusk.concat(['$main', '$util'], '\n-----\n'), 'main\n-----\nutil');
    });

    test('concatBuffer', function() {
        var result = rusk.concatBuffer(['$main', '$util']);
        assert.instanceOf(result, Buffer);
        equal(result.toString(), 'mainutil');
    });

    test('edit', function() {
        rusk.edit('$main', function(filepath, contents) {
            // save changes
            equal(filepath, rusk.expand('$main:abs'));
            equal(contents, 'main');
            return 'foobar';
        });

        rusk.edit('$main', function(filepath, contents) {
            // no change
            equal(contents, 'foobar');
        });
    });

    test('replace', function() {
        var actual = [];
        rusk.replace('TESTDATA.txt', /.+/g, function(match) {
            actual.push(match);
            return 'replaced';
        });

        rusk.replace('TESTDATA.txt', /replaced/g, function (match) {
            actual.push(match);
            return 'testdata';
        });
        deepEqual(actual, ['testdata', 'replaced']);
    });


});

