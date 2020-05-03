
const LIB = require("bash.origin.lib").forPackage(__dirname).js;

const Promise = LIB.BLUEBIRD;
const PATH = LIB.PATH;
let FS = LIB.FS_EXTRA;
const HTTP = LIB.http;
const EXPRESS = LIB.EXPRESS;
const HTTP_SHUTDOWN = LIB.HTTP_SHUTDOWN;
const BODY_PARSER = LIB.BODY_PARSER;
const MORGAN = LIB.MORGAN;
const CODEBLOCK = LIB.CODEBLOCK;
const GET_PORT = LIB.GET_PORT;
const MIME_TYPES = LIB.MIME_TYPES;
const BO = LIB.BASH_ORIGIN;


let subContextUniqueIndex = 0;

exports.hookRoutes = async function (router, routes, options) {
    options = options || {};

    if (options.LIB) {
        FS = options.LIB.FS;
        LIB.FS = FS;
        LIB.FS_EXTRA = FS;
    }

    options.basedir = (options.basedir && PATH.resolve(process.cwd(), options.basedir)) || process.cwd();
    options.mountPrefix = options.mountPrefix || null;

    router = router || new EXPRESS();

    // TODO: Use more specific VERBOSE flag.
    if (process.env.VERBOSE) {
        router.use(function (req, res, next) {
            console.log("[bash.origin.express] Request:", req.method, req.url);
            return next();
        });
    }

    if (!routes) {
        throw new Error(`No 'routes' to hook specified!`);
    }

    // Sort routes as best as we can from longest to shortest.
    var sortedRoutes = [];
    sortedRoutes = Object.keys(routes).map(function (route) {
        return [
            route
                .replace(/^\^/, "")
                .replace(/\\\//g, "/")
                .replace(/\(.*$/g, ""),
            route
        ];
    }).sort(function (a, b) {
        if (a[0].length < b[0].length) {
            return 1;
        } else {
            return -1;
        }
        return 0;
    });

    await Promise.mapSeries(sortedRoutes, async function (route) {
        route = route[1];

        var routeImpl = routes[route];
        var routeApp = null;

// console.error("routeImpl11", route, routeImpl);

        if (typeof routeImpl === "function") {
            routeApp = routeImpl({
                registerPathOnChangedHandler: options.registerPathOnChangedHandler
            });
        } else
        if (typeof routeImpl === "object") {
            var keys = Object.keys(routeImpl);

            // DEPRECATED
            if (
                keys.length === 1 &&
                /^@.+/.test(keys[0])
            ) {
                var implId = keys[0].replace(/^@/, "");
                var implConfig = routeImpl[keys[0]];

                const vars = {};
                if (options.variables) {
                    Object.keys(options.variables).forEach(function (name) {
                        vars[name] = options.variables[name];
                    });
                }
                if (implConfig.variables) {
                    Object.keys(implConfig.variables).forEach(function (name) {
                        vars[name] = implConfig.variables[name];
                    });
                }
                if (options.env) {
                    Object.keys(options.env).forEach(function (name) {
                        vars[name] = options.env[name];
                    });
                }            
                implConfig.variables = vars;

// console.error("implId 22", implId);

                if (LIB['@pinf-it/core'].isToolPointer(implId)) {

// console.error("[express] options.basedir", options.basedir, 'options.mountPrefix', options.mountPrefix, "implConfig['it.pinf.core_mountPrefix']", implConfig['it.pinf.core_mountPrefix'], 'route', route);

                    if (
                        !implConfig.dist &&
                        !/^\^/.test(route)
                    ) {
                        implConfig.dist = route;
                    }

                    // if (!implConfig.dist) {
                    //     throw new Error(`'dist' not set for implId '${implId}'!`);
                    // }

                    let mountPrefix = LIB.PATH.join(options.mountPrefix || '', implConfig['it.pinf.core_mountPrefix'] || '');
                    if (mountPrefix === '.') {
                        mountPrefix = '';
                    }

// console.error("USE MOUNT PREFIX::", mountPrefix);                    
                    const app = await LIB['@pinf-it/core']({
                        cwd: options.basedir,
                        mountPrefix: mountPrefix
                    }).getRouteApp(implId, {
                        mountPath: (implConfig.dist && LIB.PATH.resolve('/', implConfig.dist)) || '/'
                    });
                    delete implConfig.dist;
                    delete implConfig['it.pinf.core_mountPrefix'];

                    // TODO: Pass this in differently (not part of the config).
                    implConfig.SERVER = (options.API && options.API.SERVER) || {
                        stop: router.stopServer
                    };

                    if (
                        !app ||
                        typeof app !== 'function'
                    ) {
                        console.error("app:", app);
                        console.error("implConfig:", implConfig);
                        throw new Error(`No getRouteApp() for implId '${implId}'!`);
                    }

                    routeApp = await app(implConfig);

                    if (
                        !routeApp ||
                        typeof routeApp !== 'function'
                    ) {
                        console.error("implConfig:", implConfig);
                        console.error("app:", app);
                        console.error("routeApp:", routeApp);
                        throw new Error(`'routeApp' not set!`);
                    }

                } else {

                    const implMod = BO.depend(implId, implConfig);

                    if (implMod["#io.pinf/middleware~s1"]) {

                        var impl = implMod["#io.pinf/middleware~s1"];

                        routeApp = impl({
                            SERVER: {
                                stop: router.stopServer
                            }
                        });

                    } else
                    if (implMod["#io.pinf/process~s1"]) {

                        var impl = implMod["#io.pinf/process~s1"];

                        if (typeof impl !== "function") {
                            throw new Error("'#io.pinf/process~s1' API not found in '" + implId + "'!");
                        }

                        var contentType = MIME_TYPES.lookup(route) || null;
                        routeApp = function (req, res, next) {
                            impl(function (err, result) {
                                if (err) {
    //                                console.error(err.stack || err);
                                    err.message += " (for route '" + route + "')";
                                    err.stack += "\n(for route '" + route + "')";
                                    return next(err);
                                }
                                if (contentType) {
                                    res.writeHead(200, {
                                        "Content-Type": contentType
                                    });
                                }
                                res.end(result);
                            });
                        };                        

                    } else {
                        throw new Error("Module '" + implId + "' does not export API on namespace '#io.pinf/middleware~s1' nor #io.pinf/process~s1'!");
                    }
                }
            } else
            if (
                keys.length === 1 &&
                /^([^\s]+)\s*#\s*([^\s]+)\s*#\s*([^\s]+)$/.test(keys[0])
            ) {
                const modelTargetPointer = keys[0].match(/^([^\s]+)\s*#\s*([^\s]+)\s*#\s*([^\s]+)$/);
                const toolPointer = Object.keys(routeImpl[keys[0]])[0];
                const toolConfig = routeImpl[keys[0]][toolPointer];

// console.log("NEW ROUTER LOGIC", modelTargetPointer, toolPointer, toolConfig);
// console.log("options.mountPrefix", options.mountPrefix);
// console.log("target path", LIB.PATH.join(options.mountPrefix || '', modelTargetPointer[2]));

                subContextUniqueIndex += 1;

                routeApp = await LIB['@pinf-it/core']({
                    cwd: options.basedir,
                    contextId: subContextUniqueIndex
                }).runToolForModel(
                    modelTargetPointer[1],
                    `/${LIB.PATH.join(options.mountPrefix || '/', modelTargetPointer[2] || '/')}`.replace(/\/\//g, '/'),
                    `/${LIB.PATH.join(modelTargetPointer[3] || '/')}`.replace(/\/\//g, '/'),
                    toolPointer.replace(/^@/, ''),
                    toolConfig,
                    [
                        'onHome:router',
                        'onHome:path',
                        'onBuild:router',
                        'onBuild:path'
                    ],
                    {
                        // TODO: Namespace this API.
                        SERVER: {
                            middleware: {
                                static: EXPRESS.static
                            },
                            stop: router.stopServer || (options.API && options.API.SERVER && options.API.SERVER.stop) || null
                        }
                    }
                );

                if (typeof routeApp === 'string') {
                    routeImpl = routeApp;
                    routeApp = null;
                }
// console.log("routeImpl", routeImpl);
// console.log("routeApp", routeApp);
            }
        }

        if (
            !routeApp &&
            typeof routeImpl === "string" &&
            /^\/|^\./.test(routeImpl)
        ) {
            const absRouteImpl = PATH.resolve(options.basedir, routeImpl);
            
            if (!FS.existsSync(absRouteImpl)) {
                FS.mkdirsSync(absRouteImpl);
            }
            if (FS.statSync(absRouteImpl).isDirectory()) {
                routeImpl = [
                    absRouteImpl
                ];
            } else {
                // TODO: Use static file server.
                var contentType = MIME_TYPES.lookup(absRouteImpl) || null;
                routeApp = function (req, res, next) {                
                    FS.readFile(absRouteImpl, "utf8", function (err, data) {
                        if (err) {
                            err.message += " (for route '" + route + "')";
                            err.stack += "\n(for route '" + route + "')";
                            return next(err);
                        }
                        if (contentType) {
                            res.writeHead(200, {
                                "Content-Type": contentType
                            });
                        }
                        res.end(data);
                    });
                };
            }
        }

        if (
            !routeApp &&
            Array.isArray(routeImpl)
        ) {
            // Serve files.
            // TODO: Use static file server.

            routeApp = function (req, res, next) {

                // console.log("CHECK PATH: req.url", req.url);
                // console.log("CHECK PATH: req.route.path", req.route.path);

                var subPath = req.url;//.replace(req.route.path, "");

                if (subPath === '') {
                    subPath = 'index.html';
                }

                // console.log("CHECK PATH: req.mountAt", req.mountAt);
                // console.log("CHECK PATH: routeImpl", routeImpl);
                // console.log("CHECK PATH: subPath", subPath);
                // console.log("CHECK PATH: options.basedir", options.basedir);

                var path = null;
                for (var i=0; i<routeImpl.length;i++) {
                    path = PATH.resolve(options.basedir, PATH.join(routeImpl[i], subPath));

                    if (FS.existsSync(path)) {
                        break;
                    } else {
                        path = null;
                    }
                }

                if (!path) {
                    if (/^sm\/[0-9a-z]+\.map$/.test(subPath)) {
                        res.writeHead(204);
                        res.end('');
                        return;
                    }

                    return next(new Error("File for URI '" + req.url + "' not found in paths '" + routeImpl.join(", ") + "'!"));
                }

                FS.readFile(path, function (err, data) {
                    if (err) {
                        err.message += " (for route '" + route + "')";
                        err.stack += "\n(for route '" + route + "')";
                        return next(err);
                    }
                    res.writeHead(200, {
                        "Content-Type": MIME_TYPES.lookup(path)
                    });
                    res.end(data);
                });
            };
        }

        if (
            !routeApp &&
            CODEBLOCK.isCodeblock(routeImpl)
        ) {
            routeApp = await CODEBLOCK.runAsync(routeImpl, {
                ___PWD___: options.basedir,
                LIB: LIB,
                API: options.API,
                options: {
                    "EXPRESS": EXPRESS,
                    PORT: options.port,
                    env: options.env || {},
                    variables: options.variables || {},
                    hookRoutes: async function (routes) {
                        return exports.hookRoutes(router, routes, options);
                    }
                }
            }, {
                sandbox: {
                    require: require,
                    process: process,
                    setTimeout: setTimeout
                }
            });
        } else
        if (
            !routeApp &&
            typeof routeImpl === 'string'
        ) {
            routeApp = routeImpl;
        }

        // If the 'routeApp' ends up being a string we serve it with a mime type determined by the 'route'.
        if (typeof routeApp === "string") {
            var routeResponse = routeApp;
            var contentType = MIME_TYPES.lookup(route) || null;
            routeApp = function (req, res, next) {
                if (contentType) {
                    res.writeHead(200, {
                        "Content-Type": contentType
                    });
                }
                res.end(routeResponse);
                return;
            }
        }

        if (
            !routeApp ||
            typeof routeApp !== 'function'
        ) {
            console.error("routeImpl:", routeImpl);
            console.error("routeApp:", routeApp);
            throw new Error(`'routeApp' not set!`);
        }

        var routeStr = route;
        if (/^\^/.test(route)) {
            route = new RegExp(route);
        }
        // TODO: Do not log in silent mode.
        console.log("[bash.origin.express] Adding route:", route);

        // TODO: Relocate to pinf.io helper
        var routeWrapper = function (reqOriginal, res, next) {
                
            var req = {};
            Object.keys(reqOriginal).forEach(function (name) {
                req[name] = reqOriginal[name];
            });

            req.url = "/" + reqOriginal.url.replace(new RegExp(routeStr + '(.*)$'), "$1").replace(/^\//, "");
            req.mountAt = reqOriginal.url.substring(0, reqOriginal.url.length - req.url.length + 1);

            if (process.env.VERBOSE) {
                console.log("[bash.origin.express] Routing request", req.url, "with method", req.method ,"due to route", route);
            }
            try {
                return routeApp(req, res, next);
            } catch (err) {

console.error("Error for route:", route);
                next(err);
            }
        };

        router.get(route, routeWrapper);
        router.post(route, routeWrapper);            
    });

    return router;
}


async function getPort (config) {
    if (process.env.PORT) {
        return parseInt(process.env.PORT);
    }
    if (config.port) {
        return parseInt(config.port);
    }
    if (config.env && config.env.PORT) {
        return parseInt(config.env.PORT);
    }
    // TODO: Use pinf.it cache file layout to store port.
    const portCachePath = PATH.join(config.basedir, '.~bash-origin-express-port');
    let port = null;
    if (await FS.exists(portCachePath)) {
        port = await GET_PORT({
            port: parseInt(await FS.readFile(portCachePath, 'utf8'))
        });
    } else {
        port = await GET_PORT();
    }
    await FS.writeFile(portCachePath, `${port}`, 'utf8');
    return port;
}


exports.forConfig = async function (config, options) {

//console.log("config", config.routes['/dist/script.browser.js']['gi0.PINF.it/build/v0 # /dist # /script.browser.js']['@it.pinf.org.browserify # router/v1'].inject);

    options = options || {};
    if (options.LIB) FS = options.LIB.FS;

    try {
//        if (typeof config === "string") {
            config = CODEBLOCK.thawFromJSON(config);
//        }
    } catch (err) {
        console.error("config:", config);
        console.error(`Error thawing config:`, err.stack);
        process.exit(1);
    }

//console.log("config", config.routes['/dist/script.browser.js']['gi0.PINF.it/build/v0 # /dist # /script.browser.js']['@it.pinf.org.browserify # router/v1'].inject);

    config.basedir = (config.basedir && PATH.resolve(process.cwd(), config.basedir)) || process.cwd();
    config.port = await getPort(config);
    if (config.variables) {
        config.variables = CODEBLOCK.runAll(config.variables);
    } else {
        config.variables = {};
    }
    config.env = config.env || {};
    config.env.PORT = config.port;


    const router = EXPRESS();
    router.disable('x-powered-by');

    // TODO: Optionally disable.
    router.use(function (req, res, next) {
        var origin = null;
        if (req.headers.origin) {
            origin = req.headers.origin;
            // TODO: Configurable white-list.
        } else
        if (req.headers.host) {
            // TODO: Optionally use HTTPS.
            origin = `http://${req.headers.host}`;
        }
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Origin", origin);
        // TODO: Make configurable.
        res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
        // TODO: Make configurable.
        res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Cookie");
        if (req.method === "OPTIONS") {
            return res.end();
        }
        req.EXPRESS = EXPRESS;

        // TODO: Pass the 'stopServer' method when initializing middleware. Not here.
        req.stopServer = router.stopServer;

        return next();
    });

    // TODO: Optionally disable route.
    router.get(/^\/favicon\.(ico|png)$/, function (req, res, next) {
        res.writeHead(204);
        return res.end();
    });

    //app.use(MORGAN(':remote-addr - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
    router.use(MORGAN(':remote-addr - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer"'));
    // TODO: Optionally disable.
    router.use(BODY_PARSER.json());
    // TODO: Optionally disable.
    router.use(BODY_PARSER.urlencoded({
        extended: false
    }));

    router.stopServer = async function stopServer () {
        if (!server.listening) {
            return;
        }
        //server.unref();
        return new Promise(function (resolve, reject) {
            server.shutdown(function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    if (config.routes) {
        await exports.hookRoutes(router, config.routes, {
            basedir: config.basedir,
            port: config.port,
            env: config.env,
            variables: config.variables,
            mountPrefix: config.mountPrefix || null
        });
    }

    // TODO: Make configurable.
    router.use(function (req, res, next) {
        const err = new Error("[bash.origin.express] Url '" + req.url + "' not found (mountAt: " + (req.mountAt || "") + ", originalUrl: " + (req.originalUrl || "") + ")");
        err.status = 404;
        return next(err);
    });

    // TODO: Make configurable.
    router.use(function (err, req, res, next) {
        console.error("ERROR:", err.stack);
        res.status(err.status || 500);
        res.end("ERROR: " + err.message);
    });


    let server = HTTP.createServer(router);

    server = HTTP_SHUTDOWN(server);

//console.error("RETURN SERVER INIT!!");

    return {
        config: config,
        on: server.on.bind(server),
        start: async function () {

//console.error("START SERVER!!");

            return new Promise(function (resolve, reject) {
                server.listen(config.port, "127.0.0.1", function (err) {
                    if (err) return reject(err);

                    console.log("Server: http://localhost:" + config.port + "/");
                    resolve();
                });
            });
        },
        stop: async function () {
            return router.stopServer();
        }
    };
}


// Needs to work with 'mocha' & 'nightwatch'.
exports.runForTestHooks = async function (before, after, config) {

    return new Promise(function (resolve) {

        let server = null;
        let stopped = false;

        before(async function () {
            server = await exports.forConfig(config);
            if (!stopped) {
                await server.start();
            }
            if (arguments.length === 2) {
                arguments[1]();
            }
            resolve(server);
        });

        after(function (client, done) {
            if (typeof done === "undefined") {
                done = client;
                client = null;
            }
            stopped = true;
            // if (!server) {
                // throw new Error("[bash.origin.express] Cannot close server as it was never started!");
            // }
            if (client && typeof client.end === 'function') {
                client.end(async function () {
                    if (server) server.stop().then(done);
                });
            } else {
                if (server) server.stop().then(done);
            }
        });
    });
}

/*
// TODO: Add test for this code path.
if (require.main === module) {
    try {
        exports.forConfig(process.argv[2]);
    } catch (err) {
        console.error(err.stack);
        process.exit(1);
    }
}
*/
