var child_process = require('child_process');

if(child_process.spawnSync !== undefined) {
    child_process.spawn('node-gyp', ['rebuild'], {
        stdio: 'inherit'
    });
}
