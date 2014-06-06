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
        rusk.removeRecursive('test/data');
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

        assert.throws(function() {
            rusk.ls(['*.foo', '*.bar']);
        }, 'rusk.listdir');
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

        assert.throws(function() {
            // not enough arguments
            rusk.mkdir();
        }, 'rusk.expand');

        assert.throws(function() {
            // already a file exists (not directory)
            rusk.mkdir('TESTDATA.txt');
        }, 'EEXIST');
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

        assert.throws(function() {
            // not enough arguments
            rusk.move('TESTDATA.txt');
        }, 'rusk.expand');

        assert.throws(function () {
            // source is not exists
            rusk.move('not_exists_file', 'foo');
        }, 'rusk.move');

        assert.throws(function () {
            // move current directory
            rusk.move('./', 'lib');
        }, 'EBUSY');
        assert.throws(function () {
            // move directory into self
            rusk.move('lib', 'lib');
        }, 'EINVAL');
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

        assert.throws(function() {
            // not enough arguments
            rusk.copy('TESTDATA.txt');
        }, 'rusk.expand');

        assert.throws(function() {
            // copy directory to file
            rusk.copy('lib', 'TESTDATA.txt');
        }, 'ENOTDIR');
    });

    test('copy link', function() {
        fs.mkdirSync('pack');
        fs.symlinkSync('lib', 'linkdir');

        rusk.copy(['bin', 'lib', 'linkdir'], 'pack');
        assert(fs.lstatSync('pack/lib/linkmain').isSymbolicLink());
        equal(fs.readFileSync('pack/lib/linkmain', 'utf8'), 'main');

        assert(fs.lstatSync('pack/linkdir').isSymbolicLink());
        equal(fs.readFileSync('pack/linkdir/main.txt', 'utf8'), 'main');

        // replace link
        rusk.copy('linkdir', 'lib/linkmain');
        equal(fs.readlinkSync('lib/linkmain'), 'lib');
    });

    test('copy files', function() {
        rusk.copy(['$main', '$util'], 'bin');
        equal(rusk.readFile('bin/main.txt'), 'main');
        equal(rusk.readFile('bin/util.txt'), 'util');
    });

    test('remove', function() {
        rusk.remove('lib/main.txt');
        assert(fs.existsSync('lib/main.txt') === false);

        assert.doesNotThrow(function() {
            rusk.remove('not_exists_file');
        });

        assert.throws(function() {
            // cannot remove directory
            rusk.remove('lib');
        }, 'EISDIR');
    });

    test('removeRecursive', function() {
        rusk.removeRecursive('lib');
        assert(fs.existsSync('lib') === false);

        assert.doesNotThrow(function() {
            rusk.removeRecursive('not_exists_dir');
        });
    });

    test('concat', function() {
        equal(rusk.concat(['$main', '$util']), 'main\nutil');
        equal(rusk.concat(['$main', '$util'], '\n-----\n'), 'main\n-----\nutil');

        assert.throws(function() {
            rusk.concat(['not_exists_file.*']);
        }, 'rusk.concat');
    });

    test('concatBuffer', function() {
        var result = rusk.concatBuffer(['$main', '$util']);
        assert.instanceOf(result, Buffer);
        equal(result.toString(), 'mainutil');

        assert.throws(function() {
            rusk.concatBuffer(['not_exists_file.*']);
        }, 'rusk.concat');
    });

    test('edit', function() {
        // $main == main
        rusk.edit('$main', function(filepath, contents) {
            // saved
            equal(filepath, rusk.expand('$main:abs'));
            equal(contents, 'main');
            return 'foobar';
        });

        // $main == foobar
        rusk.edit('$main', function(filepath, contents) {
            // not saved
            equal(contents, 'foobar');
        });

        equal(rusk.readFile('$main'), 'foobar');
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
        equal(rusk.readFile(tempfile), 'temp');
    });

    test('modified', function(/* done */) {
        equal(rusk.modified('$main'), true);
        equal(rusk.modified('$main'), false);

        // this test is too slow
        //setTimeout(function() {
            //rusk.writeFile('$main', 'changed');
            //equal(rusk.modified('$main'), true);
            //done();
        //}, 1000);
    });
});
