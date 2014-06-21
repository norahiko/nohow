#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <sys/wait.h>
#include "spawn.hh"

using std::vector;
using namespace v8;


SpawnRunner::SpawnRunner(JsString executable, JsArray args, JsObject options) 
        : executable_(executable),
          args_(args),
          options_(options),

          timeout_(0),
          status_(0),
          child_pid_(-1) {

    JsString stdio_opt = options->Get(Symbol("stdio")).As<String>();
    use_stdio_pipe_ = stdio_opt->Equals(Symbol("pipe"));

    JsValue timeout_opt = options->Get(Symbol("timeout"));
    if(timeout_opt->IsNumber()) {
        timeout_ = static_cast<int64_t>(timeout_opt->IntegerValue());
    }
}


int SpawnRunner::Run() {
    pid_t pid = fork();
    if(pid == 0) {
        RunChild();
        exit(127);
    } else {
        return RunParent(pid);
    }
}


int SpawnRunner::RunChild() {
    if(PipeStdio()) { return 1; }
    if(SetEnvironment()) { return 1; }
    if(ChangeDirectory()) { return 1; }

    String::Utf8Value file(executable_);
    vector<char*> args = BuildArgs();
    execvp(*file, &args[0]);
    perror(*file);
    return 1;
}


int SpawnRunner::RunParent(pid_t pid) {
    child_pid_ = pid;
    int stat;
    if(0 < timeout_) {
        time_t timeout = timeout_ / 1000;
        time_t start = time(0);

        while(waitpid(pid, &stat, WNOHANG) == 0) {
            usleep(1000 * 200);
            if(timeout < time(0) - start) {
                kill(pid, SIGTERM);
            }
        }
    } else {
        waitpid(pid, &stat, 0);
    }
    return stat;
}


JsObject SpawnRunner::BuildResultObject(int stat) {
    Local<Object> result = Object::New();

    if(WIFEXITED(stat)) {
        status_ = WEXITSTATUS(stat);
    } else if(WIFSIGNALED(stat)) {
        int sig = WTERMSIG(stat);
        JsString signame = String::New(node::signo_string(sig));
        result->Set(Symbol("signal"), signame);
        status_ = 128 + sig;
    }

    result->Set(Symbol("status"), Number::New(status_));
    result->Set(Symbol("pid"), Number::New(child_pid_));
    result->Set(Symbol("file"), executable_);
    result->Set(Symbol("args"), args_);
    return result;
}


vector<char*> SpawnRunner::BuildArgs() {
    vector<char*> args;

    int arg_length = args_->Length();
    for(int i = 0; i < arg_length; i++) {
        String::Utf8Value raw(args_->Get(i));
        char* arg = new char[raw.length() + 1];
        strcpy(arg, *raw);
        args.push_back(arg);
    }
    // add sentinel
    args.push_back(NULL);
    return args;
}


int SpawnRunner::PipeStdio() {
    if(use_stdio_pipe_) {
        int infd = options_->Get(Symbol("stdinFd"))->Int32Value();
        int outfd = options_->Get(Symbol("stdoutFd"))->Int32Value();
        int errfd = options_->Get(Symbol("stderrFd"))->Int32Value();
        int err;

        err = dup2(infd, fileno(stdin));
        if(err == -1) { perror("stdin pipe"); return 1; }
        err = dup2(outfd, fileno(stdout));
        if(err == -1) { perror("stdout pipe"); return 1; }
        err = dup2(errfd, fileno(stderr));
        if(err == -1) { perror("stderr pipe"); return 1; }
    }
    return 0;
}


int SpawnRunner::SetEnvironment() {
    JsObject env = options_->Get(Symbol("env")).As<Object>();
    JsArray names = env->GetOwnPropertyNames();

    for(uint32_t i = 0; i < names->Length(); i++) {
        JsString name = names->Get(i).As<String>();
        JsValue value = env->Get(name);

        if(value->IsString()) {
            String::Utf8Value raw_name(name);
            String::Utf8Value raw_value(value);
            // ignore errors
            setenv(*raw_name, *raw_value, 1);
        }
    }
    return 0;
}


int SpawnRunner::ChangeDirectory() {
    JsValue cwd = options_->Get(Symbol("cwd"));
    if(cwd->IsString()) {
        String::Utf8Value raw_cwd(cwd);
        int err = chdir(*raw_cwd);
        if(err) {
            perror(*raw_cwd);
            return err;
        }
    }
    return 0;
}

