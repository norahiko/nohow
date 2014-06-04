'use strict';

if(global.__rusk) {
    module.exports = global.__rusk;
} else {
    module.exports = require('./rusk.js');
    Object.defineProperty(global, '__rusk', {
        configurable: true,
        writable: true,
        value: module.exports,
    });
}
