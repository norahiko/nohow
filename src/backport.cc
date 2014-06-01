// Backport of spawnSync for RuskJS

#include <nan.h>
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <iostream>
#include <string>
#include <sstream>

using namespace std;
using v8::Object;
using v8::Number;
using v8::String;
using v8::Local;
using v8::FunctionTemplate;

void readFile(string, ostringstream*);


NAN_METHOD(Prompt) {
    NanScope();
    if(args.Length() < 1) {
        return NanThrowError("you must supply a argument");
    }
    cout << NanCString(args[0], NULL);
    string input;
    getline(cin, input);
    NanReturnValue(NanNew<String>(input.c_str()));
}

NAN_METHOD(Execute) {
    NanScope();
    if(args.Length() != 2) {
        return NanThrowError("Invalid arguments");
    }

    char* command = NanCString(args[0], NULL);
    char* tempdir_path = NanCString(args[1], NULL);

    int pid = getpid();
    ostringstream outfile;
    ostringstream errfile;
    outfile << tempdir_path << "/out" << pid;
    errfile << tempdir_path << "/err" << pid;

    ostringstream exec_command;
    exec_command << command << " > " << outfile.str() << " 2> " << errfile.str();

    FILE *fp = popen(exec_command.str().c_str(), "w");
    if(fp == NULL) {
        return NanThrowError("popen failed");
    }
    int code = pclose(fp);
    int status;
    if(WIFEXITED(code)) {
        status = WEXITSTATUS(code);
    } else {
        status = 1;
    }

    ostringstream stdout;
    ostringstream stderr;
    readFile(outfile.str(), &stdout);
    readFile(errfile.str(), &stderr);

    Local<Object> res = NanNew<Object>();
    res->Set(NanSymbol("status"), NanNew<Number>(status));
    res->Set(NanSymbol("out"), NanNew<String>(stdout.str().c_str()));
    res->Set(NanSymbol("err"), NanNew<String>(stderr.str().c_str()));
    NanReturnValue(res);
}

void readFile(string filename, ostringstream *out) {
    FILE *fp = fopen(filename.c_str(), "r");
    if(fp == NULL) {
        return;
    }
    int bufsize = 1024;
    char buf[bufsize];
    while(fgets(buf, bufsize, fp) != NULL) {
        *out << buf;
    }
    fclose(fp);
}

NAN_METHOD(Test) {
    NanScope();
    NanReturnNull();
}

void init(v8::Handle<Object> exports) {
    exports->Set(NanSymbol("prompt"), NanNew<FunctionTemplate>(Prompt)->GetFunction());
    exports->Set(NanSymbol("exec"), NanNew<FunctionTemplate>(Execute)->GetFunction());
    exports->Set(NanSymbol("test"), NanNew<FunctionTemplate>(Test)->GetFunction());
}

NODE_MODULE(backport, init)

