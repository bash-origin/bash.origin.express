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
                    "/": "<head><title>Hello World</title></head><body>Hello World!</body>"
                }
            }

        <<<),
        "routes": {
            "alive": {
                "uri": "/",
                "expect": "<head><title>Hello World</title></head><body>Hello World!</body>",
                "exit": true
            }
        }
    }
}

echo "OK"
