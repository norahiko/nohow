var pathModule = require('path');
var fs = require('fs');
var rusk = require('../lib/rusk.js');

var assert = require('chai').assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
var env = rusk.env;

var root = process.cwd();

suite('Change directory command:', function() {
    setup(function () {
        process.chdir(root);
    });

    test('chdir', function () {
        rusk.chdir('~');
        equal(process.cwd(), env.HOME);
    });

    test('pushd', function() {
        rusk.pushd('test');
        assert.notEqual(process.cwd(), root);
        rusk.popd();
        equal(process.cwd(), root);
    });
});


suite('Shell command:', function() {
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

    test('listdir', function() {
        deepEqual(rusk.listdir(), ['TESTDATA.txt', 'bin', 'lib']);
        assert.notDeepEqual(rusk.ls('~'), []);
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
        var contents = [];
        rusk.replace('TESTDATA.txt', /.+/g, function(match) {
            contents.push(match);
            return 'replaced';
        });

        rusk.replace('TESTDATA.txt', /replaced/g, function (match) {
            contents.push(match);
            return 'testdata';
        });
        deepEqual(contents, ['testdata', 'replaced']);
    });

    test('tempfile', function() {
        var tempfile = rusk.tempfile('temp');
        equal(fs.readFileSync(tempfile).toString(), 'temp');
    });
});

