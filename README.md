Nohow
====

The task runner with synchronous API

```sh
$ nohow hello
[Info] Task 'sleep' start
[Log] Hello, world!
```

```javascript
// nohow.js
task("hello", function() {
    // desc: Greeting
    log("Hello, world!");
});

task("build", function() {
    // desc: build scripts
    mkdir("build");
    concat("lib/*.js").save("build/app.js");
});

task("watch", function() {
    watch(["lib/*.js"], function() {
        run("build");
    });
});

task("sleep", function() {
    exec("sleep 5");
    // 5 seconds later
    log("Good morning!!!");
});
```


## Roadmap

0.0.1
  * Add tools: exec, spawn, shell, system
  * Implement polyfill of execSync, spawnSync

0.0.2
  * Add tools: request, wget
  * Add examples

0.0.3
  * Add tools: zip, unzip

0.0.4
  * Add tools: tiny-reloader
  * Beautify webserver

0.1.0
  * Create some plugins (e.g. reloader, coffee-script, ...)


## License

MIT
