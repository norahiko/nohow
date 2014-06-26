#include <node.h>
#include "spawn.hh"

using namespace v8;


JsValue spawn_sync(Args arguments) {
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


void init(Handle<Object> exports) {
    NODE_SET_METHOD(exports, "spawnSync", spawn_sync);
}


NODE_MODULE(polyfill, init)
