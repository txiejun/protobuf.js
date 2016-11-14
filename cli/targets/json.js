var protobuf = require("../..");

module.exports = json_target;

/**
 * .json target.
 * @param {!Object} options Target options
 * @param {function(?Error, string=)} callback Callback
 */
function json_target(root, options, callback) {
    process.nextTick(function() {
        callback(null, JSON.stringify(root, null, 2));    
    });
}
