#!/usr/bin/env bash.origin.script

depend {
    "pages": "@com.github/bash-origin/bash.origin.express#1"
}

function PRIVATE_Run {

    CALL_pages run {
        "routes": {
            "/": "Hello World!"
        }
    }

}

PRIVATE_Run "$@"
