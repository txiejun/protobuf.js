var protobuf = require("../..");

module.exports = json_source;

/**
 * .json source.
 * @param {string[]} files Files to load
 * @param {!Object} options Source options
 * @param {function(?Error, Root=)} callback Callback function
 */
function json_source(files, options, callback) {
    protobuf.load(files, function(err, root) {
        callback(err, root);
    });
}
