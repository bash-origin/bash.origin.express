
const PATH = require("path");
const HTTP = require("http");
const EXPRESS = require("express");
const BODY_PARSER = require("body-parser");
const MORGAN = require("morgan");

const PORT = parseInt(process.env.PORT || "8080");


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
app.use(EXPRESS.static(PATH.join(__dirname, 'www')));

//app.use('/', routes);

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


var server = HTTP.createServer(app);

console.log("ARGS", process.argv);

console.log("Starting server at: http://localhost:" + PORT + "/");

server.listen(PORT, "127.0.0.1", function (err) {
    if (err) {
        console.error(err.stack);
        process.exit(1);
    }

    console.log("... started!");

});


/*
            var defaultRoute = null;
            var routes = config.routes();
            routes.forEach(function (route) {
                if (route.$alias === "route/default") {
                    defaultRoute = route;
                } else {
                    spine.log("Register route: " + route.route);
                    app.use(new RegExp(route.route), route.app);
                }
            });
            spine.log("Register route: " + defaultRoute.route);
            app.get(new RegExp(defaultRoute.route), defaultRoute.app);

*/
