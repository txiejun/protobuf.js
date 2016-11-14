var protobuf = require("../..");

module.exports = json_source;

/**
 * .json source.
 * @param {Root} root Root instance to populate
 * @param {string[]} files Files to load
 * @param {!Object} options Source options
 * @param {function(?Error, Root=)} callback Callback function
 */
function json_source(root, files, options, callback) {
    root.load(files, callback);
}
