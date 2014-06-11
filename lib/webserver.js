'use strict';

var commands = require('./commands.js');
var fs = require('fs');
var http = require('http');
var pathModule = require('path');

var DEFAULT_PORT = 8000;
var DEAFAULT_HOST = 'localhost';

module.exports = webserver;


function webserver(options) {
    options = normalizeOptions(options);
    var server = http.createServer(function(req, res) {
        requestHandler(req, res, options);
    });
    server.listen(options.port, options.host, options.listenCallback);
    if(options.logging) {
        console.log('WebServer listening on %s:%s', options.host, options.port);
    }
    return server;
}


function normalizeOptions(options) {
    var result = {};
    options = options || {};

    if(typeof options !== 'object') {
        throw new TypeError(
            'Invalid arguments \'jub.webserver\'\n' +
            'Usage:' +
            '  webserver({\n' +
            '    port           : 8000,         // optional\n' +
            '    host           : "",           // optional\n' +
            '    documentRoot   : "/home/www",  // optional\n' +
            '    logging        : true,         // optional\n' +
            '    listenCallback : function(){}, // optional\n' +
            '  });'
        );
    }
    var env = commands.env;
    if(options.port) {
        result.port = Number(commands.expand(options.port.toString()), 10);
    } else {
        result.port = Number(env.PORT) || DEFAULT_PORT;
    }

    if(options.host) {
        result.host = commands.expand(options.host);
    } else {
        result.host = env.HOST || DEAFAULT_HOST;
    }

    var root = options.documentRoot || env.DOCUMENT_ROOT || commands.env.root;
    result.documentRoot = pathModule.resolve(root);
    result.logging = !!options.logging;
    result.listenCallback = options.listenCallback;
    return result;
}


function requestHandler(req, res, options) {
    var pathnameRaw = /^[^#?]*/.exec(req.url)[0];
    pathnameRaw = pathnameRaw.replace(/\.\.\//g, '');
    var pathname = decodeURIComponent(pathnameRaw);
    var filepath = pathModule.join(options.documentRoot, pathname.slice(1));

    if(fs.existsSync(filepath) === false) {
        notFound(pathname, res, options);
        return;
    }

    var stat = fs.statSync(filepath);
    var readable = 256;

    if(stat.mode & readable === 0) {
        forbidden(pathname, res, options);

    } else if(stat.isDirectory()) {
        var indexPath = pathModule.join(filepath, 'index.html');
        if(pathname[pathname.length - 1] !== '/') {
            redirect(pathnameRaw + '/', res, options);

        } else if(fs.existsSync(indexPath)) {
            sendFile(pathname, indexPath, res, options);

        } else {
            sendListDirectory(pathnameRaw, filepath, res, options);
        }

    } else if(stat.isFile()) {
        sendFile(pathname, filepath, res, options);

    } else {
        notFound(pathname, res, options);
    }
}


function sendFile(pathname, filepath, res, options) {
    if(options.logging) {
        console.log('200 ' + pathname);
    }
    var type = guessMimetype(filepath);
    res.writeHead(200, {'Content-Type': type});
    fs.createReadStream(filepath).pipe(res);
}


function sendListDirectory(pathname, dirpath, res, options) {
    if(options.logging) {
        console.log('200 ' + pathname);
    }
    var body = [];
    if(pathname !== '/') {
        // add link to parent directory
        body.push('<li><a href="../">../</a></li>');
    }

    var files = fs.readdirSync(dirpath);
    files.forEach(function(file) {
        var path = dirpath + pathModule.sep + file;
        var stat = fs.lstatSync(path);
        var href = pathname + encodeURIComponent(file);
        if(stat.isDirectory()) {
            href += '/';
            file += '/';
        } else if(stat.isSymbolicLink()) {
            file += '@';
        }
        body.push('<li><a href="', href, '">', file, '</a></li>\n');
    });

    res.writeHead(200, {'Content-Type': 'text/html', });
    res.write('<!DOCTYPE html><html><body>\n');
    res.write('<h1>' + decodeURIComponent(pathname) + '</h1>\n');
    res.write(body.join(''));
    res.end('\n</body></html>');
}


function guessMimetype(path) {
    var ext = pathModule.extname(path).toLowerCase();
    if(mimeTypes[ext]) {
        return mimeTypes[ext];
    }

    if(containsNullByte(path)) {
        return 'application/octet-stream';
    }
    return 'text/plain';
}


function containsNullByte(path) {
    var bufsize = 8192;
    var buffer = new Buffer(bufsize);
    var fd = fs.openSync(path, 'r');
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


function redirect(pathname, res, options) {
    if(options.logging) {
        console.log('301 ' + pathname);
    }
    res.writeHead(301, {'Location': pathname});
    res.end('');
}


function forbidden(pathname, res, options) {
    if(options.logging) {
        console.log('403 ' + pathname);
    }
    res.writeHead(403, {'Content-Type': 'text/html'});
    res.end('<h1>Forbidden</h1><dd>' + pathname + '</dd>');
}


function notFound(pathname, res, options) {
    if(options.logging) {
        console.log('404 ' + pathname);
    }
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.end('<h1>File Not found</h1><dd>' + pathname + '</dd>');
}


// Copyright Python Software Foundation

var mimeTypes = {
    '.appcache' : 'text/cache-manifest',
    '.avi'      : 'video/x-msvideo',
    '.bash'     : 'text/plain',
    '.bmp'      : 'image/x-ms-bmp',
    '.css'      : 'text/css',
    '.c'        : 'text/plain',
    '.cc'       : 'text/plain',
    '.coffee'   : 'text/plain',
    '.cpp'      : 'text/plain',
    '.cs'       : 'text/plain',
    '.doc'      : 'application/msword',
    '.dot'      : 'application/msword',
    '.flv'      : 'video/x-flv',
    '.gif'      : 'image/gif',
    '.groovy'   : 'text/plain',
    '.go'       : 'text/plain',
    '.gz'       : 'application/gzip',
    '.h'        : 'text/plain',
    '.hs'       : 'text/plain',
    '.htm'      : 'text/html',
    '.html'     : 'text/html',
    '.ico'      : 'image/vnd.microsoft.icon',
    '.java'     : 'text/plain',
    '.jpeg'     : 'image/jpeg',
    '.jpg'      : 'image/jpeg',
    '.js'       : 'application/javascript',
    '.json'     : 'application/json',
    '.less'     : 'text/plain',
    '.m4a'      : 'audio/acc',
    '.manifest' : 'text/cache-manifest',
    '.md'       : 'text/plain',
    '.midi'     : 'audio/midi',
    '.ml'       : 'text/plain',
    '.mp3'      : 'audio/mpeg',
    '.mp4'      : 'video/mp4',
    '.mpeg'     : 'video/mpeg',
    '.mpg'      : 'video/mpeg',
    '.ogg'      : 'audio/ogg',
    '.pdf'      : 'application/pdf',
    '.php'      : 'text/plain',
    '.pl'       : 'text/plain',
    '.py'       : 'text/plain',
    '.png'      : 'image/png',
    '.rb'       : 'text/plain',
    '.rst'      : 'text/plain',
    '.sass'     : 'text/plain',
    '.scss'     : 'text/plain',
    '.scala'    : 'text/plain',
    '.sh'       : 'text/plain',
    '.sql'      : 'text/plain',
    '.styl'     : 'text/plain',
    '.swf'      : 'application/x-shockwave-flash',
    '.ts'       : 'text/plain',
    '.txt'      : 'text/plain',
    '.vim'      : 'text/plain',
    '.wav'      : 'audio/x-wav',
    '.webm'     : 'video/webm',
    '.webp'     : 'image/webp',
    '.xhtml'    : 'application/xhtml+xml',
    '.xml'      : 'text/xml',
    '.xsl'      : 'application/xml',
    '.xls'      : 'application/msexcel',
    '.yaml'     : 'application/yaml',
    '.yml'      : 'application/yaml',
    '.zip'      : 'application/zip',
};
