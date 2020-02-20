#!/usr/bin/env bash.origin.script

echo ">>>TEST_IGNORE_LINE:Waiting until program <<<"

depend {
    "process": "bash.origin.process # runner/v0"
}

CALL_process run {
    "server": {
        "env": {
            "PORT": 3000
        },
        "run": (bash () >>>
            #!/usr/bin/env bash.origin.script

            depend {
                "server": "bash.origin.express # server/v0"
            }

            CALL_server run {
                "routes": {
                    "/": function /* CodeBlock */ (options) {

                        return function (req, res, next) {
                            res.end("<head><title>Hello World</title></head><body>Hello World!</body>");
                        };
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
