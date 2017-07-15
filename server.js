
const PATH = require("path");
const HTTP = require("http");
const EXPRESS = require(PATH.join(__dirname, ".rt/it.pinf.org.npmjs/node_modules", "express"));
const BODY_PARSER = require(PATH.join(__dirname, ".rt/it.pinf.org.npmjs/node_modules", "body-parser"));
const MORGAN = require(PATH.join(__dirname, ".rt/it.pinf.org.npmjs/node_modules", "morgan"));
const CODEBLOCK = require(PATH.join(__dirname, ".rt/it.pinf.org.npmjs/node_modules", "codeblock"));
const MIME_TYPES = require(PATH.join(__dirname, ".rt/it.pinf.org.npmjs/node_modules", "mime-types"));
const BO = require('bash.origin');


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

    app.use(MORGAN(':remote-addr - ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
    app.use(BODY_PARSER.json());
    app.use(BODY_PARSER.urlencoded({
        extended: false
    }));


    var config = CONFIG.config || {};
    config = CODEBLOCK.runAll(config);


    if (CONFIG.routes) {

        Object.keys(CONFIG.routes).forEach(function (route) {

            var routeImpl = CONFIG.routes[route];

            if (typeof routeImpl === "object") {
                var keys = Object.keys(routeImpl);
                if (
                    keys.length === 1 &&
                    /^@.+\./.test(keys[0])
                ) {
                    var implId = keys[0].replace(/^@/, "");
                    var implConfig = routeImpl[keys[0]];

                    var impl = BO.depend(implId, implConfig)["#io.pinf/process~s1"];

                    var error = null;
                    var result = null;
                    impl(function (err, output) {
                        if (err) {
                            error = err;
                        } else {
                            result = output;
                        }
                    });

                    var contentType = MIME_TYPES.lookup(route) || null;
                    routeImpl = function (req, res, next) {
                        if (error) {
                            return next(error);
                        }
                        if (contentType) {
                            res.writeHead(200, {
                                "Content-Type": contentType
                            });
                        }
                        res.end(result);
                    };
                }
            }

            var routeApp = null;
            if (typeof routeImpl === "function") {
                routeApp = routeImpl;
            } else {
                routeApp = CODEBLOCK.run(routeImpl, {
                    options: {
                        "EXPRESS": EXPRESS,
                        PORT: parseInt(PORT),
                        config: config
                    }
                }, {
                    sandbox: {
                        require: require
                    }
                });
            }

            if (typeof routeApp === "string") {
                var routeResponse = routeApp;
                routeApp = function (req, res, next) {
                    res.writeHead(200, {
                        "Content-Type": "text/html"
                    });
                    res.end(routeResponse);
                    return;
                }
            }

            if (/^\^/.test(route)) {
                route = new RegExp(route);
            }
            console.log("Adding route:", route);
            app.get(route, routeApp);
            app.post(route, routeApp);
        });
    }

    app.use(EXPRESS.static(PATH.join(__dirname, 'www')));


    app.use(function (req, res, next) {
        const err = new Error('Not Found');
        err.status = 404;
        return next(err);
    });

    app.use(function (err, req, res, next) {
        console.error("ERROR:", err.stack);
        res.status(err.status || 500);
        res.end("ERROR: " + err.message);
    });



    console.log("Server: http://localhost:" + parseInt(PORT) + "/");


    var server = HTTP.createServer(app);

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
        exports.forConfig(config, function (err, _server) {
            if (err) {
                return done(err);
            }
            server = _server;
            return done();
        });
    });

    after(function (client, done) {
        client.end(function() {
            server.close(done);
        });
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
