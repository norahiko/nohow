#ifndef SPAWN_H
#define SPAWN_H

#include <vector>
#include <node.h>

#define TypeError(msg) ThrowException(Exception::TypeError(String::New(msg)));
#define Symbol(c_str) String::NewSymbol(c_str)

typedef const v8::Arguments&  Args;
typedef v8::Handle<v8::Value> JsValue;
typedef v8::Local<v8::String> JsString;
typedef v8::Local<v8::Array>  JsArray;
typedef v8::Local<v8::Object> JsObject;


class SpawnRunner {

    public:
        SpawnRunner(JsString, JsArray, JsObject);

        int Run();
        JsObject BuildResultObject(int);

    private:
        JsString executable_;
        JsArray args_;
        JsObject options_;

        char* exec_file_;
        JsObject env_;
        bool use_stdio_pipe_;
        int64_t timeout_; // milliseconds
        int share_mem_id_;

        int status_;
        pid_t child_pid_;

        std::vector<char*> BuildArgs();
        int RunChild();
        int RunParent(pid_t);
        int SetEnvironment();
        int PipeStdio();
        int ChangeDirectory();
};
#endif
