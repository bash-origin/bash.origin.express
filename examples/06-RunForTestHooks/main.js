#!/usr/bin/env bash.origin.test via github.com/mochajs/mocha

const LIB = require('bash.origin.lib').js;

console.log(">>>TEST_IGNORE_LINE:^Server:<<<");

describe("Suite", function () {

    const server = LIB.BASH_ORIGIN_EXPRESS.runForTestHooks(before, after, {
        "routes": {
            "/": "<head><title>Hello World</title></head><body>Hello World!</body>"
        }
    });

    it('Test', async function () {

        const PORT = (await server).config.port;

        LIB.ASSERT.equal(typeof PORT, 'number');

        const response = await LIB.BENT('buffer')(`http://localhost:${PORT}/`);

        LIB.ASSERT.equal(response.toString(), '<head><title>Hello World</title></head><body>Hello World!</body>');
    });
});
