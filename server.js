
const LIB = require("bash.origin.lib").forPackage(__dirname).js;

const Promise = LIB.BLUEBIRD;
const PATH = LIB.PATH;
const FS = LIB.FS_EXTRA;
const HTTP = LIB.http;
const EXPRESS = LIB.EXPRESS;
const HTTP_SHUTDOWN = LIB.HTTP_SHUTDOWN;
const BODY_PARSER = LIB.BODY_PARSER;
const MORGAN = LIB.MORGAN;
const CODEBLOCK = LIB.CODEBLOCK;
const GET_PORT = LIB.GET_PORT;
const MIME_TYPES = LIB.MIME_TYPES;
const BO = LIB.BASH_ORIGIN;


exports.hookRoutes = async function (router, routes, options) {
    options = options || {};

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

        if (typeof routeImpl === "function") {
            routeApp = routeImpl({
                registerPathOnChangedHandler: options.registerPathOnChangedHandler
            });
        } else
        if (typeof routeImpl === "object") {
            var keys = Object.keys(routeImpl);
            if (
                keys.length === 1 &&
                /^@.+\./.test(keys[0])
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

                var implMod = BO.depend(implId, implConfig);

console.log("implId:", implId);
console.log("implConfig:", implConfig);
console.log("implMod:", implMod);
// Invoke PINF.it interface.
throw new Error(`NYI`);

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
        }

        if (
            !routeApp &&
            typeof routeImpl === "string" &&
            /^\//.test(routeImpl)
        ) {
            if (!FS.existsSync(routeImpl)) {
                FS.mkdirsSync(routeImpl);
            }
            if (FS.statSync(routeImpl).isDirectory()) {
                routeImpl = [
                    routeImpl
                ];
            } else {
                // TODO: Use static file server.
                var contentType = MIME_TYPES.lookup(routeImpl) || null;
                routeApp = function (req, res, next) {                
                    FS.readFile(routeImpl, "utf8", function (err, data) {
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

//console.log("SETUP ROUTE APP", routeImpl);
            routeApp = function (req, res, next) {

                var subPath = req.url.replace(req.route.path, "");
//console.log("subPath", subPath);

                var path = null;
                for (var i=0; i<routeImpl.length;i++) {
                    path = PATH.join(routeImpl[i], subPath);
                    if (FS.existsSync(path)) {
                        break;
                    } else {
                        path = null;
                    }
                }                
                if (!path) {
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

            return routeApp(req, res, next);
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



exports.forConfig = async function (config) {

    try {
//        if (typeof config === "string") {
            config = CODEBLOCK.thawFromJSON(config);
//        }
    } catch (err) {
        console.error("config:", config);
        console.error(`Error thawing config:`, err.stack);
        process.exit(1);
    }

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

    if (config.routes) {
        await exports.hookRoutes(router, config.routes, {
            port: config.port,
            env: config.env,
            variables: config.variables
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

    router.stopServer = async function stopServer () {
        if (!server.listening) {
            return;
        }
        //server.unref();
        return new Promise(function (resolve, reject) {
            server.shutdown(function (err) {
                if (err) return reject(err);
                return resolve();
            });
        });
    }
    server = HTTP_SHUTDOWN(server);

    return {
        start: async function () {

            return new Promise(function (resolve, reject) {
                server.listen(config.port, "127.0.0.1", function (err) {
                    if (err) return reject(err);

                    console.log("Server: http://localhost:" + config.port + "/");
                    return resolve();
                });
            });
        },
        stop: async function () {
            return router.stopServer();
        }
    };
}


exports.runForTestHooks = function (before, after, config) {

    var server = null;

    before(async function () {
        server = await exports.forConfig(config);
    });

    after(async function (client) {
        if (!server) {
            throw new Error("[bash.origin.express] Cannot close server as it was never started!");
        }
        if (client && typeof client.end === 'function') {
            client.end(function () {
                return server.stop();
            });
        } else {
            return server.stop();
        }
    });

    /*
    before(function (client, done) {
        
        if (typeof done === "undefined") {
            done = client;
            client = null;
        }

        exports.forConfig(config, function (err, _server) {
            if (err) {
                return done(err);
            }
            server = _server;
            return done();
        });
    });

    after(function (client, done) {

        if (typeof done === "undefined") {
            done = client;
            client = null;
        }

        if (!server) {
            throw new Error("Cannot close server as it was never started!");
        }

        if (client) {
            client.end(function() {
                server.close(done);
            });
        } else {
            server.close(done);
        }
    });
    */
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
