#!/usr/bin/env bash.origin.script

export PORT="8080"

depend {
    "pages": {
        "@com.github/bash-origin/bash.origin.express#s1": {
            "routes": {
                "/": "<head><title>Hello World</title><script src=\"/app.js\"></script></head><body>Hello World!</body>",
                "/app.js": function /* CodeBlock */ (options) {

                    options["_org.webping.watch#s1"].fsFileCodeblock("$__FILENAME__", "$__LINE__");

                    const static = options.EXPRESS.static("$__DIRNAME__");

                    return function (req, res, next) {

                        req["_org.webping.watch#s1"].fsPath("$__DIRNAME__" + req.url.replace(/\?.*$/, ""));

                        return static(req, res, next);
                    };
                }
            }
        }    
    }
}

function PRIVATE_Run {

    # TODO: Boradcast UDP event for
    # options["_org.webping.watch#s1"].fsPath("$__FILENAME__");

# TODO: Use 'CALL_start' which uses bash.origin.process (mon) to start server
#       so we can then make request usign curl and then stop server again.
    CALL_pages run {

    }

}

function PRIVATE_Verify {
    # TODO: Instead of just sleeping for 1 second, use curl to call server
    #       until we get a reponse or timeout. Use 'bash.origin.request' to
    #       make the calls.
    sleep 1
    local requestID=`uuidgen`
    local command="curl -s "http://${DOCKER_CONTAINER_HOST_IP}:${PORT}/?rid=$requestID""
    echo "Command: $command"
    local response=`$command`
    echo "Response: $response"

    #if [ "${response}" != "Hello World from dockerized NodeJS process!" ]; then
    #		echo "ERROR: Did not get expected response!"
    #		exit 1
    #fi
}

#PRIVATE_Run "$@"

echo "SKIP"
