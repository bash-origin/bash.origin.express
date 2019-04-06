
const LIB = require("bash.origin.lib").forPackage(__dirname).js;


const PATH = LIB.path;
const FS = LIB.FS_EXTRA;
const HTTP = LIB.http;
const EXPRESS = LIB.EXPRESS;
const HTTP_SHUTDOWN = LIB.HTTP_SHUTDOWN;
const BODY_PARSER = LIB.BODY_PARSER;
const MORGAN = LIB.MORGAN;
const CODEBLOCK = LIB.CODEBLOCK;
const MIME_TYPES = LIB.MIME_TYPES;
const BO = LIB.BASH_ORIGIN;


exports.hookRoutes = function (app, routes) {

    if (typeof routes === "undefined") {
        routes = app;
        app = new EXPRESS();
    }

    if (process.env.VERBOSE) {
        app.use(function (req, res, next) {
            console.log("[bash.origin.express] Request:", req.method, req.url);
            return next();
        });
    }

    // Sort routes as best as we can
    var keys = [];
    keys = Object.keys(routes).map(function (route) {
            return [
                route
                    .replace(/^\^/, "")
                    .replace(/\\\//g, "/")
                    .replace(/\(.*$/g, ""),
                route
            ];
        })
        .sort(function (a, b) {
            if (a[0].length < b[0].length) {
                return 1;
            } else {
                return -1;
            }
            return 0;
        });

    keys.forEach(function (route) {
        route = route[1];

        var routeImpl = routes[route];
        var routeApp = null;

        if (typeof routeImpl === "function") {
            routeApp = routeImpl();
        } else
        if (typeof routeImpl === "object") {
            var keys = Object.keys(routeImpl);
            if (
                keys.length === 1 &&
                /^@.+\./.test(keys[0])
            ) {
                var implId = keys[0].replace(/^@/, "");
                var implConfig = routeImpl[keys[0]];

                implConfig.variables = implConfig.variables || {};
                implConfig.variables.PORT = app.PORT;

                var implMod = BO.depend(implId, implConfig);

                if (implMod["#io.pinf/middleware~s1"]) {

                    var impl = implMod["#io.pinf/middleware~s1"];

                    routeApp = impl({
                        SERVER: {
                            stop: app.stopServer
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

        if (!routeApp) {
            routeApp = CODEBLOCK.run(routeImpl, {
                options: {
                    "EXPRESS": EXPRESS,
                    PORT: parseInt(app.PORT),
                    config: app.config,
                    hookRoutes: function (routes) {
                        return exports.hookRoutes(app, routes);
                    }
                }
            }, {
                sandbox: {
                    require: require,
                    process: process,
                    setTimeout: setTimeout
                }
            });
        }

        if (typeof routeApp === "string") {
            var routeResponse = routeApp;
            var contentType = MIME_TYPES.lookup(routeImpl) || null;
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
        console.log("[bash.origin.express] Adding route:", route);

        // TODO: Relocate to pinf.io helper
        var routeWrapper = function (reqOriginal, res, next) {
                
            var req = {};
            Object.keys(reqOriginal).forEach(function (name) {
                req[name] = reqOriginal[name];
            });

            req.url = "/" + reqOriginal.url.replace(new RegExp(routeStr + '(.*)$'), "$1").replace(/^\//, "");
            req.mountAt = reqOriginal.url.substring(0, reqOriginal.url.length - req.url.length + 1);
                        
            if (true || process.env.VERBOSE) {
                console.log("[bash.origin.express] Routing request", req.url, "with method", req.method ,"due to route", route);
            }

            return routeApp(req, res, next);
        };

        app.get(route, routeWrapper);
        app.post(route, routeWrapper);            
    });

    return app;
}



exports.forConfig = function (config, callback) {

    var CONFIG = {};
    try {
        if (typeof config === "string") {
            CONFIG = CODEBLOCK.thawFromJSON(config);
        } else {
            CONFIG = config;
        }
    } catch (err) {
        console.error(err.stack);
        process.exit(1);
    }

    const PORT = (CONFIG.port && parseInt(CONFIG.port)) || (process.env.PORT && parseInt(process.env.PORT)) || 8080;


    const app = EXPRESS();
    app.disable('x-powered-by');

    app.PORT = PORT;

    app.use(function (req, res, next) {
        var origin = null;
        if (req.headers.origin) {
            origin = req.headers.origin;
        } else
        if (req.headers.host) {
            origin = [
                "http://",
                req.headers.host
            ].join("");
        }
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
        res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Cookie");
        if (req.method === "OPTIONS") {
            return res.end();
        }
        req.EXPRESS = EXPRESS;
        return next();
    });


    app.get(/^\/favicon\.(ico|png)$/, function (req, res, next) {
        res.writeHead(204);
        return res.end();
    });

    //app.use(MORGAN(':remote-addr - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
    app.use(MORGAN(':remote-addr - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer"'));
    app.use(BODY_PARSER.json());
    app.use(BODY_PARSER.urlencoded({
        extended: false
    }));


    var config = CONFIG.config || {};
    config = CODEBLOCK.runAll(config);
    app.config = config;
    
    var server = null;

    app.stopServer = function stopServer (callback) {
        if (!server.listening) {
            if (callback) callback();
            return;
        }
        server.unref();
        server.shutdown(callback);
    }

    if (CONFIG.routes) {
        exports.hookRoutes(app, CONFIG.routes);
    }

    app.use(EXPRESS.static(PATH.join(__dirname, 'www')));


    app.use(function (req, res, next) {
        const err = new Error("[bash.origin.express] Url '" + req.url + "' not found (mountAt: " + (req.mountAt || "") + ", originalUrl: " + (req.originalUrl || "") + ")");
        err.status = 404;
        return next(err);
    });

    app.use(function (err, req, res, next) {
        console.error("ERROR:", err.stack);
        res.status(err.status || 500);
        res.end("ERROR: " + err.message);
    });



    console.log("Server: http://localhost:" + parseInt(PORT) + "/");


    server = HTTP.createServer(app);

    server = HTTP_SHUTDOWN(server);

    server.listen(parseInt(PORT), "127.0.0.1", function (err) {
        if (err) {
            if (callback) {
                return callback(err);
            }
            console.error(err.stack);
            process.exit(1);
        }

        console.log("[READY]");

        return callback(null, server);
    });
}


exports.runForTestHooks = function (before, after, config) {

    var server = null;

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
}


if (require.main === module) {

    exports.forConfig(process.argv[2], function (err) {
        if (err) {
            console.error(err.stack);
            process.exit(1);
        }
    });
}
