
const PATH = require("path");
const HTTP = require("http");
const EXPRESS = require("express");
const BODY_PARSER = require("body-parser");
const MORGAN = require("morgan");
const FAYE = require("faye");
const EXPRESS_HTTP_PROXY = require("express-http-proxy");
const HARMON = require("harmon");
const THROUGH = require("through");
const CHOKIDAR = require("chokidar");
const CODEBLOCK = require("codeblock");


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
    res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
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




//CHOKIDAR


const API = {
    "_org.webping.watch#s1": {
        fsPath: function (path) {

console.log("WATCH FS PATH", path);

        },
        fsFileCodeblock: function (path, line) {

console.log("WATCH FS FILE CODEBLOCK", path, line);

        }
    }
}

function watchRequestedFile (url) {


    return ('PING222: ' + url);
}

app.use(function (req, res, next) {

    req["_org.webping.watch#s1"] = API["_org.webping.watch#s1"];

//    res.setHeader("x-org.webping.notify#s1", watchRequestedFile(req.url.replace(/\?.*$/, "")));
    return next();
});

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
    res
        .status(err.status || 500)
        .render('error', {
            message: err.message
        });
});



console.log("App Server: http://localhost:" + (parseInt(PORT) - 1) + "/");
console.log("Dev Server: http://localhost:" + parseInt(PORT) + "/");


var server = HTTP.createServer(app);

server.listen((parseInt(PORT) - 1), "127.0.0.1", function (err) {
    if (err) {
        console.error(err.stack);
        process.exit(1);
    }


    var devApp = EXPRESS();

    var selects = [];

    function injectIntoHeader (code) {
        var injector = {};
        injector.query = 'head';
        injector.func = function (node) {
          	var ws = node.createStream({ outer: false });
            var prefixed = false;
            ws.pipe(THROUGH(function (buf) {
                if (!prefixed) {
                    this.queue(code);
                    prefixed = true;
                }
                this.queue(buf);
            })).pipe(ws);
        }
        selects.push(injector);
    }

    injectIntoHeader([
        '<script type="text/javascript" src="/_github.com~faye~faye/client.js"></script>',
        '<script>' + (function () {
            var client = new Faye.Client('/_github.com~faye~faye');
            var subscription = client.subscribe('/foo', function(message) {
                console.log("message", message);
            });
            window.addEventListener('unload', function () {
                subscription.cancel();
            });
        }).toString().replace(/^function \(\) \{\n(?:[\s\n]*)?([\s\S]+?)\s*\}$/mg, "$1").replace(/\n\s*/g, " ") + '</script>'
    ].join(""));


    var requestedPaths = {};

    devApp.use(HARMON([], selects, true));

    devApp.use(EXPRESS_HTTP_PROXY(
        "http://localhost:" + (parseInt(PORT) - 1),
        {
            intercept: function (rsp, data, req, res, callback) {

console.log("RSP headers", rsp.headers);

                var path = req.url.replace(/\?.*$/, "");

                if (!requestedPaths[path]) requestedPaths[path] = 0;
                requestedPaths[path] += 1;

console.log("requestedPaths", requestedPaths);

                return callback(null, data);
            }
        }
    ));
    var devServer = HTTP.createServer(devApp);

    var bayeux = new FAYE.NodeAdapter({
        mount: "/_github.com~faye~faye",
        timeout: 45
    });
    bayeux.attach(devServer);


    // TODO: Send message to client when URI changes
    //bayeux.getClient().publish('/foo', {text: 'Hi there'});


    devServer.listen(parseInt(PORT), "127.0.0.1", function (err) {
        if (err) {
            console.error(err.stack);
            process.exit(1);
        }

        console.log("[READY]");
    });
});
