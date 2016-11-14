var benchmark = require("benchmark"),
    chalk     = require("chalk");
    
var protobuf  = require("../src/index"),
    suite     = new benchmark.Suite(),
    data      = require("./bench.json");

protobuf.load(require.resolve("./bench.proto"), function onload(err, root) {
    var Test = root.lookup("Test");

    // protobuf.util.codegen.verbose = true;
    var buf = Test.encode(data).finish(),
        dec = Test.decode(buf);

    var str = JSON.stringify(data),
        strbuf = Buffer.from(str, "utf8");

    newSuite("encoding")
    .add("Type.encode to buffer", function() {
        Test.encode(data).finish();
    })
    .add("JSON.stringify to string", function() {
        JSON.stringify(data);
    })
    .add("JSON.stringify to buffer", function() {
        new Buffer(JSON.stringify(data), "utf8");
    })
    .run();

    newSuite("decoding")
    .add("Type.decode from buffer", function() {
        Test.decode(buf);
    })
    .add("JSON.parse from string", function() {
        JSON.parse(str);
    })
    .add("JSON.parse from buffer", function() {
        JSON.parse(strbuf.toString("utf8"));
    })
    .run();

    newSuite("combined")
    .add("Type to/from buffer", function() {
        Test.decode(Test.encode(data).finish());
    })
    .add("JSON to/from string", function() {
        JSON.parse(JSON.stringify(data));
    })
    .add("JSON to/from buffer", function() {
        JSON.parse(new Buffer(JSON.stringify(data), "utf8").toString("utf8"));
    })
    .run();

});

var padSize = 27;

function newSuite(name) {
    var benches = [];
    return new benchmark.Suite(name)
    .on("add", function(event) {
        benches.push(event.target);
    })
    .on("start", function() {
        console.log("benchmarking " + name + " performance ...\n");
    })
    .on("error", function(err) {
        console.log("ERROR:", err);
    })
    .on("cycle", function(event) {
        console.log(String(event.target));
    })
    .on("complete", function(event) {
        var fastest = this.filter('fastest'),
            slowest = this.filter('slowest');
        var fastestHz = getHz(fastest[0]);
        console.log("\n" + chalk.white(pad(fastest[0].name, padSize)) + " was " + chalk.green("fastest"));
        benches.forEach(function(bench) {
            if (fastest.indexOf(bench) > -1)
                return;
            var hz = hz = getHz(bench);
            var percent = (1 - (hz / fastestHz)) * 100;
            console.log(chalk.white(pad(bench.name, padSize)) + " was " + chalk.red(percent.toFixed(1)+'% slower'));
        });
        console.log();
    });
}

function getHz(bench) {
    return 1 / (bench.stats.mean + bench.stats.moe);
}

function pad(str, len, l) {
    while (str.length < len)
        str = l ? str + " " : " " + str;
    return str;
}