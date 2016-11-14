var minimist = require("minimist"),
    path     = require("path"),
    resolve  = require("resolve-from"),
    chalk    = require("chalk");

var protobuf = require(".."),
    util     = require("./util"),
    sources  = util.requireAll("./sources"),
    targets  = util.requireAll("./targets"),
    pkg      = require("../package.json");

exports.main = function(args) {
    var argv = minimist(args.slice(2), {
        alias: {
            source: "s",
            target: "t"
        },
        string: [ "source", "target" ],
        default: {
            source: "proto",
            target: "json"
        }
    });
    var source = sources[argv.source],
        target = targets[argv.target],
        files  = argv._;

    if (!source || !target || !files.length) {
        console.log([
            "protobuf.js v" + pkg.version + " cli",
            "",
            "Converts between proto and json file formats.",
            "",
            "usage: " + chalk.bold.green(path.basename(process.argv[1])) + " [--source " + chalk.bold.white("proto") + "|json] [--target " + chalk.bold.white("json") + "|proto3] file1.proto file2.proto ..."
        ].join("\n"));
        return 1;
    }

    source(files, {}, function(err, root) {
        if (err)
            throw err;
        target(root, {}, function(err, output) {
            if (err)
                throw err;
            process.stdout.write(output, "utf8");
        });
    });
};
