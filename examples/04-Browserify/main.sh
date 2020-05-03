#!/usr/bin/env bash.origin.script

echo ">>>TEST_IGNORE_LINE:Waiting until program <<<"

depend {
    "process": "bash.origin.process # runner/v0"
}

CALL_process run {
    "server": {
        "env": {
            "PORT": "3000"
        },
        "run": (bash () >>>
            #!/usr/bin/env bash.origin.script

            depend {
                "server": "bash.origin.express # server/v0"
            }

            CALL_server run {
                "routes": {
                    "/code.js": {
                        "gi0.PINF.it/build/v0 # /.dist # /code.js": {
                            "@it.pinf.org.browserify # router/v1": {
                                "src": "$__DIRNAME__/code.js"
                            }
                        }
                    }
                }
            }

        <<<),
        "routes": {
            "alive": {
                "uri": "/code.js",
                "expect": "/window.hello = \"world\";/",
                "exit": true
            }
        }
    }
}

echo "OK"
