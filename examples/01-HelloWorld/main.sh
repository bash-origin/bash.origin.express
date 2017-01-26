#!/usr/bin/env bash.origin.script

export PORT="8080"

depend {
    "pages": "@com.github/bash-origin/bash.origin.express#1"
}

function PRIVATE_Run {

    return;

# TODO: Use 'CALL_start' which uses bash.origin.process (mon) to start server
#       so we can then make request usign curl and then stop server again.
    CALL_pages run {
        "routes": {
            "/": "Hello World!"
        }
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

PRIVATE_Run "$@"
