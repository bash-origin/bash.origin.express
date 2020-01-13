#!/usr/bin/env bash.origin.script

echo ">>>TEST_IGNORE_LINE:Waiting until program <<<"

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
                "config": {
                    "title": "Hello World",
                    "body": function /* CodeBlock */ (options) {
                        return "Hello World!";
                    }
                },
                "routes": {
                    "/": function /* CodeBlock */ (options) {
                        return "<head><title>" + options.config.title + "</title></head><body>" + options.config.body + "</body>";
                    }
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
