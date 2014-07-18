Nohow
====

The task runner with synchronous API

```sh
$ nohow hello
[Info]  Task 'sleep' start
[Log]   Hello, world!
```

```javascript
// nohow.js

env.src = expand("$ROOT/lib/*.js");
env.outdir = "build";
env.out = "app.js";

task("hello", function() {
    // desc: Greeting
    log("Hello, world!");
});

task("build", function() {
    // desc: build scripts
    mkdir("$distdir");
    concat("$src").save("$outdir/$out");
});

task("watch", function() {
    watch("$src", function() {
        run("build");
    });
});

task("sleep", function() {
    env.sec = 5;
    exec("sleep $sec");
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
