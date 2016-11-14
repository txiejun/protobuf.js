var protobuf = require("../..");

module.exports = proto_source;

/**
 * .proto source.
 * @param {Root} root Root instance to populate
 * @param {string[]} files Input files
 * @param {!Object} options Source options
 * @param {function(?Error, Root=)} callback Callback function
 */
function proto_source(root, files, options, callback) {
    root.load(files, callback);
}
