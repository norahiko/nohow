"use strict";

if(global.__jub) {
    module.exports = global.__jub;
} else {
    module.exports = require("./jub.js");
    Object.defineProperty(global, "__jub", {
        configurable: true,
        writable: true,
        value: module.exports,
    });
}
