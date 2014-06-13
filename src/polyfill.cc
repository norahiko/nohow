#include <node.h>
#include <v8.h>
#include <iostream>

using namespace v8;

Handle<Value> foo(const Arguments& args) {
    HandleScope scope;
    Local<Number> result = Number::New(10);
    return scope.Close(result);
}

void init(Handle<Object> target) {
    HandleScope(scope);
    target->Set(String::NewSymbol("foo"),
                FunctionTemplate::New(foo)->GetFunction());
}

NODE_MODULE(polyfill, init)
