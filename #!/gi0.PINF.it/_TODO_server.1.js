
const PATH = require("path");
const HTTP = require("http");
const EXPRESS = require("express");
const BODY_PARSER = require("body-parser");
const MORGAN = require("morgan");
const CODEBLOCK = require("codeblock");
const UUID = require("uuid");
const LODASH = require("lodash");


const PORT = parseInt(process.env.PORT || "8080");


var CONFIG = {};
try {
    CONFIG = CODEBLOCK.thawFromJSON(process.argv[2]);
} catch (err) {
    console.error(err.stack);
    process.exit(1);
}


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

app.use(MORGAN('combined'));
app.use(BODY_PARSER.json());
app.use(BODY_PARSER.urlencoded({
    extended: false
}));


const API = {
    "_org.webping.watch#s1": (new (function API () {
        var self = this;

        if (!API._singleton) {
            API._singleton = API;

            API._singleton.contexts = {};

            API._singleton.newContext = function () {
                var api = new API();
                return (API._singleton.contexts[api.id] = api);
            }

            API._singleton.getPathsForContextId = function (id) {
                if (!API._singleton.contexts[id]) return null;
                var paths = LODASH.merge({}, self.paths);
                paths = LODASH.merge(paths, API._singleton.contexts[id].paths);
                return {
                    "fs": paths
                };
            }
        }

        self.id = UUID.v4();
        self.paths = {};

        self.getId = function () {
            return ctxId;
        }

        function ensurePath (path) {
            if (!self.paths[path]) {
                self.paths[path] = {};
            }
            return self.paths[path];
        }
        function ensurePart (path, partId, partMeta) {
            var obj = ensurePath(path);
            if (!obj.parts) {
                obj.parts = {};
            }
            return (obj.parts[partId] = partMeta);
        }

        self.fsPath = function (path) {
            ensurePath(path);
        }

        self.fsFileCodeblock = function (path, line) {
            ensurePart(path, "line:" + line, {
                type: "codeblock",
                line: line
            });
        }

        self.shadowApp = function () {
            return function (req, res, next) {
                var api = API._singleton.newContext();

                res.setHeader("x-org.webping.meta#s1", "/_org.webping.meta_s1/" + api.id);

                req["_org.webping.watch#s1"] = api;

                return next();
            };
        }

        self.metaApp = function () {
            return function (req, res, next) {

                var paths = API._singleton.getPathsForContextId(req.params[0]);
                if (paths) {
                    return res.json({
                        paths: paths
                    });
                }
                res.status(404);
                res.end();
                return;
            };
        }

        self.hookIntoApp = function (app) {

            app.use(self.shadowApp());
            app.get(/^\/_org\.webping\.meta_s1\/([^\/]+)$/, self.metaApp());

        }
    })())
}

function watchRequestedFile (url) {


    return ('PING222: ' + url);
}


API["_org.webping.watch#s1"].hookIntoApp(app);


if (CONFIG.routes) {
    Object.keys(CONFIG.routes).forEach(function (route) {

        var routeApp = CODEBLOCK.run(CONFIG.routes[route], {
            options: {
                "EXPRESS": EXPRESS,
                "_org.webping.watch#s1": API["_org.webping.watch#s1"]
            }
        });

        if (typeof routeApp === "string") {
            routeApp = function (req, res, next) {
                res.writeHead(200, {
                    "Content-Type": "text/html"
                });
                res.end(CONFIG.routes[route]);
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
        console.error(err.stack);
        process.exit(1);
    }

    console.log("[READY]");

});
