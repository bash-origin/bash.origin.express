
exports['gi0.pinf.it/core/v0/tool'] = async function (workspace, LIB) {

    return async function (instance) {

        if (/\/server\/v0$/.test(instance.kindId)) {

            const SERVER = require("./server");
            LIB.Promise.promisifyAll(SERVER);

            let server = null;

            return async function (invocation) {

                if (invocation.method === 'run') {

                    if (invocation.mount.path === 'start') {

                        const config = invocation.config.config;
                        config.autostart = false;
                        server = await SERVER.forConfigAsync(config);
                        await server.start();

                    } else
                    if (invocation.mount.path === 'stop') {
                        await server.stop();
                    }

                    return true;
                }
            };            
        }
    };
}
