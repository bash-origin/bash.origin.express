
exports.forConfig = function (config) {

    var exports = {};

    exports.run = function (callback) {

        require("./server").forConfig(config, callback);
    }

    return exports;
}
