"use strict";

if(global.__nohow) {
    module.exports = global.__nohow;
} else {
    module.exports = require("./nohow.js");
    Object.defineProperty(global, "__nohow", {
        configurable: true,
        writable: true,
        value: module.exports,
    });
}
