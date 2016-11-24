var path     = require("path"),
    fs       = require("fs");
var minimist,
    chalk;

var protobuf = require(".."),
    util     = require("./util"),
    targets  = util.requireAll("./targets"),
    pkg      = require("../package.json");

exports.main = function(args) {
    try {
        minimist = require("minimist");
        chalk    = require("chalk");
    } catch (e) {
        console.log("pbjs is missing one of its dependencies. Either install the development dependencies or run:\n\n$> npm install chalk@1 minimist@1");
        return 2;
    }

    var argv = minimist(args.slice(2), {
        alias: {
            target : "t",
            out    : "o",
            path   : "p"
        },
        string: [ "target", "out", "path" ],
        default: {
            target: "json"
        }
    });
    var target = targets[argv.target],
        files  = argv._;

    if (!target || !files.length) {
        console.log([
            "protobuf.js v" + pkg.version + " cli",
            "",
            "Consolidates imports and converts between file formats.",
            "",
            "  -t, --target    Specifies the target format. [" + Object.keys(targets).filter(function(key) { return !targets[key].private; }).join(', ') + "]",
            "  -o, --out       Saves to a file instead of writing to stdout.",
            "",
            "usage: " + chalk.bold.green(path.basename(process.argv[1])) + " [options] file1.proto file2.json ..."
        ].join("\n"));
        return 1;
    }

    var root = new protobuf.Root();

    root.resolvePath = function pbjsResolvePath(origin, target) {
        // TODO: Resolve include paths here
        // -> argv.path { undefined | string | string[] }
        return protobuf.util.resolvePath(origin, target);
    };

    var options = {};

    root.load(files, function(err) {
        if (err)
            throw err;
        target(root, options, function(err, output) {
            if (err)
                throw err;
            if (output !== "") {
                if (argv.out)
                    fs.writeFileSync(argv.out, output, { encoding: "utf8" });
                else
                    process.stdout.write(output, "utf8");
            }
            process.exit(0);
        });
    });
};
