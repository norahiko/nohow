#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
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
          child_pid_(-1),
          has_timedout_(false) {
    JsValue timeout_opt = options->Get(Symbol("timeout"));
    if(timeout_opt->IsNumber()) {
        timeout_ = static_cast<int64_t>(timeout_opt->IntegerValue());
    }
}


int SpawnRunner::Run() {
    pid_t pid = fork();
    if(pid == 0) {
        RunChild();
        _exit(127);
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
    fprintf(stderr, "errno: %d\n", errno);
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
            usleep(1000 * 500);
            if(timeout < time(0) - start) {
                kill(pid, SIGTERM);
                has_timedout_ = true;
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
        result->Set(Symbol("signal"), Null());
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
    result->Set(Symbol("_hasTimedOut"), Boolean::New(has_timedout_));
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
    JsArray stdio = options_->Get(Symbol("stdio")).As<Array>();

    const char* files[3] = {"/dev/stdin", "/dev/stdout", "/dev/stderr"};
    const char* names[3] = {"stdin pipe", "stdout pipe", "stderr pipe"};
    int modes[3] = {O_RDONLY, O_WRONLY, O_WRONLY};

    for(int i = 0; i < 3; i++) {
        JsValue pipe = stdio->Get(Number::New(i));
        int fd;

        if(pipe->IsNumber()) {
            fd = pipe->IntegerValue();
        } else {
            fd = open(files[i], modes[i]);
            if(fd == -1) {
                fprintf(stderr, "errno: %d\n", errno);
                perror(files[i]);
                return 1;
            }
        }
        if(dup2(fd, i) == -1) {
            fprintf(stderr, "errno: %d\n", errno);
            perror(names[i]);
            return 1;
        }
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
            fprintf(stderr, "errno: %d\n", errno);
            perror(*raw_cwd);
            return err;
        }
    }
    return 0;
}
