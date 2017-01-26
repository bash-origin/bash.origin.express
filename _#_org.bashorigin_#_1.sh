#!/usr/bin/env bash.origin.script

depend {
    "npm": {
        "@com.github/pinf-it/it.pinf.org.npmjs#1": {
            "dependencies": {
                "express": "^4.14.0",
                "morgan": "^1.7.0",
                "body-parser": "^1.16.0"
            }
        }
    }
}


pushd "$__DIRNAME__" > /dev/null
    CALL_npm ensure dependencies
popd > /dev/null


function EXPORTS_run {

    export NODE_PATH="$__DIRNAME__/.rt/it.pinf.org.npmjs/node_modules:$NODE_PATH"
    BO_run_node "$__DIRNAME__/server.js" "$@"

}
