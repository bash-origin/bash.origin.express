#!/usr/bin/env bash.origin.script

depend {
    "npm": {
        "@com.github/pinf-it/it.pinf.org.npmjs#s1": {
            "dependencies": {
                "express": "^4.14.0",
                "morgan": "^1.7.0",
                "body-parser": "^1.16.0",
                "codeblock": "^0.2.2",
                "uuidgen": "^1.0.0",
                "lodash": "^4.17.4",
                "mime-types": "^2.1.15",
                "http-shutdown": "^1.2.0"
            }
        }
    }
}

# TODO: Port to it.pinf.org.npmjs
if [ -e "$__DIRNAME__/../github.com~0ink~codeblock.js" ]; then
    rm -Rf "$__DIRNAME__/.rt/it.pinf.org.npmjs/node_modules/codeblock" || true
    ln -s "../../../../github.com~0ink~codeblock.js" "$__DIRNAME__/.rt/it.pinf.org.npmjs/node_modules/codeblock"
fi

function EXPORTS_run {
    export NODE_PATH="$__DIRNAME__/node_modules:$__DIRNAME__/.rt/it.pinf.org.npmjs/node_modules:$NODE_PATH"
    BO_run_recent_node "$__DIRNAME__/server.js" "$@"
}
