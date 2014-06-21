#include <node.h>
#include <string.h>
#include <iostream>
#include <sstream>

#include <unistd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <errno.h>
#include <stdlib.h>
#include <stdio.h>
#include <time.h>

#include "spawn.hh"

using namespace v8;
using namespace std;


Handle<Value> spawn_sync(Args arguments) {
    HandleScope scope;

    if(arguments.Length() != 3 ||
       arguments[0]->IsString() == false ||
       arguments[1]->IsArray() == false ||
       arguments[2]->IsObject() == false) {
        return TypeError("Invalid arguments");
    }

    JsString executable = arguments[0].As<String>();
    JsArray args = arguments[1].As<Array>();
    JsObject options = arguments[2].As<Object>();

    SpawnRunner runner(executable, args, options);
    int stat = runner.Run();
    JsObject result = runner.BuildResultObject(stat);
    return scope.Close(result);
}


JsValue test(Args arguments) {
    HandleScope scope;
    return Null();
}


void init(Handle<Object> exports) {
    NODE_SET_METHOD(exports, "spawnSync", spawn_sync);
    NODE_SET_METHOD(exports, "test", test);
}


NODE_MODULE(polyfill, init)
