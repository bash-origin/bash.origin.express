#!/usr/bin/env bash.origin.script

function EXPORTS_run {

    doc={
        "# +1": "gi0.PINF.it/core",
        "# +2": {
            "server": "${__DIRNAME__}/../gi0.PINF.it/#!inf.json"
        },
        ":server:": "server @ server/v0",

        "gi0.PINF.it/core/v0 @ # :server: set() config": ${1},
        "gi0.PINF.it/core/v0 @ # :server: run() start": ""
    }

    echo "${doc}" | pinf.it ---
}
