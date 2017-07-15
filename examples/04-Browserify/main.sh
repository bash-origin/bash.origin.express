#!/usr/bin/env bash.origin.script

depend {
    "process": "@com.github/bash-origin/bash.origin.process#s1"
}

CALL_process run "bash.origin.express~01-HelloWorld" {
    "server": {
        "env": {
            # TODO: Use dynamic port
            "PORT": "3000"
        },
        "run": (bash () >>>
            #!/usr/bin/env bash.origin.script

            depend {
                "server": "@com.github/bash-origin/bash.origin.express#s1"
            }

            CALL_server run {
                "routes": {
                    "/code.js": {
                        "@it.pinf.org.browserify#s1": {
                            "src": "$__DIRNAME__/code.js"
                        }
                    }
                }
            }

        <<<),
        "routes": {
            "alive": {
                "uri": "/code.js",
                "expect": "TBD",
                "exit": true
            }
        }
    }
}

echo "OK"
