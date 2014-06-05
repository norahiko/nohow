#!/usr/bin/env node

'use strict';

var rusk = require('../lib/__rusk.js');
rusk._nextMode();
rusk._extendsNativeObject();
rusk._loadPlugins();


var options = rusk._parseArgs(process.argv.slice(2));

if(options.ruskfilePath === undefined) {
    options.ruskfilePath = rusk._findRuskfile() || null;
}

if(options.ruskfilePath) {
    rusk._loadRuskfile(options.ruskfilePath);
}

if(options.helpFlag) {
    rusk._printHelp(options);
    process.exit(0);
}
