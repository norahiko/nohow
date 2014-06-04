#!/usr/bin/env node

'use strict';

var rusk = require('../lib/__rusk.js');
rusk._nextMode();
rusk._extendsNativeObject();
rusk._loadPlugins();

var ruskfilePath = rusk._findRuskfile();
if(ruskfilePath) {
    rusk._loadRuskfile(ruskfilePath);
}
