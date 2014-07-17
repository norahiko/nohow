"use strict";

var helper = require("./helper");
var logging = helper.lazylib.logging;
var tools = helper.lazylib.tools;
var fs = require("fs");
var http = require("http");
var pathModule = require("path");

var DEFAULT_PORT = 8000;
var DEAFAULT_HOST = "localhost";

module.exports = StaticServer;


function StaticServer(options) {
    options = normalizeOptions(options);

    var server = http.createServer(function(req, res) {
        var handler = new RequestHandler(req, res, options);
        handler.handle();
    });
    server.listen(options.port, options.host, options.callback);

    if(options.logging) {
        logging.info("StaticServer listening on %s:%s", options.host, options.port);
    }
    return server;
}


function normalizeOptions(options) {
    var result = {};
    options = options || {};

    if(typeof options !== "object") {
        throw new TypeError(
            "Invalid arguments 'nohow.StaticServer'\n" +
            "Usage:" +
            "  StaticServer({\n" +
            "    port         : 8000,         // optional\n" +
            "    host         : '',           // optional\n" +
            "    documentRoot : '/home/www',  // optional\n" +
            "    logging      : true,         // optional\n" +
            "    callback     : function(){}, // optional\n" +
            "  });"
        );
    }
    var env = tools.env;
    if(options.port) {
        result.port = Number(tools.expand(options.port.toString()), 10);
    } else {
        result.port = Number(env.STATIC_PORT) || DEFAULT_PORT;
    }

    if(options.host) {
        result.host = tools.expand(options.host);
    } else {
        result.host = env.STATIC_HOST || DEAFAULT_HOST;
    }

    if(options.documentRoot) {
        result.documentRoot = tools.expand(options.documentRoot);
    } else {
        result.documentRoot = env.STATIC_DOCUMENT_ROOT || tools.env.ROOT;
    }

    result.documentRoot = pathModule.resolve(result.documentRoot);
    result.logging = !!options.logging;
    result.callback = options.callback;
    return result;
}


function RequestHandler(req, res, options) {
    var url = /^[^#?]*/.exec(req.url)[0];
    url = url.replace(/\/\.{1,2}(?=\/|$)/g, "");     // remove "/../" or "/./
    url = url.replace(/^\/+/, "/");

    this.url = url;
    this.requested = decodeURIComponent(url);
    this.filepath = pathModule.join(options.documentRoot, this.requested);
    this.res = res;
    this.logging = !!options.logging;
}


RequestHandler.prototype.handle = function() {
    if(fs.existsSync(this.filepath) === false) {
        this.notFound();
        return;
    }

    var stat = fs.statSync(this.filepath);
    var readable = 256; // 0400;

    if((stat.mode & readable) === 0) {
        this.forbidden();

    } else if(stat.isDirectory()) {
        this.serveDirectory();

    } else if(stat.isFile()) {
        this.serveFile();

    } else {
        this.notFound();
    }
};



RequestHandler.prototype.serveFile = function () {
    if(this.logging) {
        logging.info("200 " + this.requested);
    }

    var type = guessMimetype(this.filepath);
    this.res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(this.filepath).pipe(this.res);
};


RequestHandler.prototype.serveDirectory = function() {
    if(this.requested[this.requested.length - 1] !== "/") {
        this.url += "/";
        this.redirect();
        return;
    }

    var indexPage = pathModule.join(this.filepath, "index.html");
    if(fs.existsSync(indexPage)) {
        this.filepath = indexPage;
        this.serveFile();
    } else {
        this.serveListDirectory();
    }
};


RequestHandler.prototype.serveListDirectory = function () {
    // jshint quotmark: false
    var handler = this;
    if(this.logging) {
        logging.info("200 " + this.requested);
    }

    var body = [];
    if(this.requested !== "/") {
        // add link to parent directory
        body.push('<li><a href="../">../</a></li>');
    }

    var files = fs.readdirSync(this.filepath);
    var dir = this.filepath;
    if(dir[dir.length - 1] !== "/") {
        dir += "/";
    }

    files.forEach(function(filename) {
        var p = dir + filename;
        var stat = fs.lstatSync(p);
        var url = handler.url + encodeURIComponent(filename);

        if(stat.isDirectory()) {
            url += "/";
            filename += "/";
        } else if(stat.isSymbolicLink()) {
            filename += "@";
        }
        body.push('<li><a href="', url, '">', filename, '</a></li>\n');
    });

    this.res.writeHead(200, {"Content-Type": "text/html", });
    this.res.write("<!DOCTYPE html><html><body>\n");
    this.res.write("<h1>" + decodeURIComponent(this.requested) + "</h1>\n");
    this.res.write(body.join(""));
    this.res.end("\n</body></html>");
};


RequestHandler.prototype.redirect = function() {
    if(this.logging) {
        logging.info("301 " + this.requested);
    }

    this.res.writeHead(301, { "Location": this.url });
    this.res.end("");
};


RequestHandler.prototype.forbidden = function() {
    if(this.logging) {
        logging.error("403 " + this.requested);
    }

    this.res.writeHead(403, {"Content-Type": "text/html"});
    this.res.end("<h1>Forbidden</h1><dd>" + this.requested + "</dd>");
};


RequestHandler.prototype.notFound = function() {
    if(this.logging) {
        logging.error("404 " + this.requested);
    }

    this.res.writeHead(404, {"Content-Type": "text/html"});
    this.res.end("<h1>File Not found</h1><dd>" + this.requested + "</dd>");
};


function guessMimetype(path) {
    var ext = pathModule.extname(path).toLowerCase();
    if(mimeTypes[ext]) {
        return mimeTypes[ext];
    }

    if(containsNullByte(path)) {
        return "application/octet-stream";
    }
    return "text/plain";
}


function containsNullByte(path) {
    var bufsize = 8192;
    var buffer = new Buffer(bufsize);
    var fd = fs.openSync(path, "r");
    var readBytes;

    while(true) {
        readBytes = fs.readSync(fd, buffer, 0, bufsize);
        if(readBytes === 0) {
            break;
        }
        for(var i = 0; i < readBytes; i++) {
            if(buffer[0] === 0) {
                fs.closeSync(fd);
                return true;
            }
        }
    }
    fs.closeSync(fd);
    return false;
}



// Copyright Python Software Foundation

var mimeTypes = {
    ".appcache" : "text/cache-manifest",
    ".avi"      : "video/x-msvideo",
    ".bash"     : "text/plain",
    ".bmp"      : "image/x-ms-bmp",
    ".css"      : "text/css",
    ".c"        : "text/plain",
    ".cc"       : "text/plain",
    ".coffee"   : "text/plain",
    ".cpp"      : "text/plain",
    ".cs"       : "text/plain",
    ".doc"      : "application/msword",
    ".dot"      : "application/msword",
    ".flv"      : "video/x-flv",
    ".gif"      : "image/gif",
    ".groovy"   : "text/plain",
    ".go"       : "text/plain",
    ".gz"       : "application/gzip",
    ".h"        : "text/plain",
    ".hs"       : "text/plain",
    ".htm"      : "text/html",
    ".html"     : "text/html",
    ".ico"      : "image/vnd.microsoft.icon",
    ".java"     : "text/plain",
    ".jpeg"     : "image/jpeg",
    ".jpg"      : "image/jpeg",
    ".js"       : "application/javascript",
    ".json"     : "application/json",
    ".less"     : "text/plain",
    ".m4a"      : "audio/acc",
    ".manifest" : "text/cache-manifest",
    ".md"       : "text/plain",
    ".midi"     : "audio/midi",
    ".ml"       : "text/plain",
    ".mp3"      : "audio/mpeg",
    ".mp4"      : "video/mp4",
    ".mpeg"     : "video/mpeg",
    ".mpg"      : "video/mpeg",
    ".ogg"      : "audio/ogg",
    ".pdf"      : "application/pdf",
    ".php"      : "text/plain",
    ".pl"       : "text/plain",
    ".py"       : "text/plain",
    ".png"      : "image/png",
    ".rb"       : "text/plain",
    ".rst"      : "text/plain",
    ".sass"     : "text/plain",
    ".scss"     : "text/plain",
    ".scala"    : "text/plain",
    ".sh"       : "text/plain",
    ".sql"      : "text/plain",
    ".styl"     : "text/plain",
    ".swf"      : "application/x-shockwave-flash",
    ".ts"       : "text/plain",
    ".txt"      : "text/plain",
    ".vim"      : "text/plain",
    ".wav"      : "audio/x-wav",
    ".webm"     : "video/webm",
    ".webp"     : "image/webp",
    ".xhtml"    : "application/xhtml+xml",
    ".xml"      : "text/xml",
    ".xsl"      : "application/xml",
    ".xls"      : "application/msexcel",
    ".yaml"     : "application/yaml",
    ".yml"      : "application/yaml",
    ".zip"      : "application/zip",
};
