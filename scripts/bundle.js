var browserify = require('browserify');

var header     = require('gulp-header');
var gulpif     = require('gulp-if');
var sourcemaps = require('gulp-sourcemaps');
var uglify     = require('gulp-uglify');
var gutil      = require('gulp-util');

var buffer     = require('vinyl-buffer');
var vinylfs    = require('vinyl-fs');
var source     = require('vinyl-source-stream');

var pkg = require(__dirname + '/../package.json');
var license = [
    "/*!",
    " * protobuf.js v${version} (c) 2016 Daniel Wirtz",
    " * Compiled ${date}",
    " * Licensed under the Apache License, Version 2.0",
    " * see: https://github.com/dcodeIO/protobuf.js for details",
    " */"
].join('\n') + '\n';

module.exports = bundle;

function bundle(compress) {
    var bundler = browserify({
        entries: __dirname + '/../src/index.js',
        debug: true
    })
    return bundler
    .external("long")
    .external("buffer")
    .exclude("process")
    .exclude("_process") // what is it...
    .exclude("fs")
    .bundle()
    .pipe(source(compress ? 'protobuf.min.js' : 'protobuf.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
            .pipe(
                gulpif(compress, uglify({ mangleProperties: { regex: /^(?!(?:_fields|_oneofs)$)_/ } })) // _fields/_oneofs is used on prototypes
            )
            .pipe(header(license, {
                date: (new Date()).toUTCString().replace('GMT', 'UTC'),
                version: pkg.version
            }))
    .pipe(sourcemaps.write('.', { sourceRoot: '' }))
    .pipe(vinylfs.dest(__dirname + '/../dist'))
    .on("log", gutil.log)
    .on("error", gutil.log);
}
