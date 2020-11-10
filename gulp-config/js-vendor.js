var gulp = require("gulp");
var uglify = require("gulp-uglify");
var concat = require("gulp-concat-util");
var insert = require("gulp-insert");

gulp.task("js-vendor", function () {
    return gulp.src([
            "./src/deps/async.min.js",
            "./src/deps/jquery.min.js",
            "./src/deps/stats.min.js",
            "./src/deps/tween.min.js",
            "./src/deps/underscore.min.js",

            "./src/deps/three.min.js",
            "./src/deps/threejs/js/controls/*.js",
            "./src/deps/threejs/js/geometries/*.js",
            "./src/deps/threejs/js/postprocessing/*.js",
            "./src/deps/threejs/js/shaders/*.js",
            "./src/deps/threejs/js/utils/*.js",
            "./src/deps/threejs/js/vr/*.js",
        ])

        .pipe(concat("gibson-deps.min.js", { sep: ";" }))

        .pipe(insert.prepend([
                "/*! hack the gibson! / http://paulynomial.com */",
                "/*! three.js / threejs.org/license */",
                "/*! tween.js - http://github.com/sole/tween.js */",
            ].join("\n")))

        .pipe(uglify({
            mangle: false,
            preserveComments: "license"
        }))

        .pipe(gulp.dest(global.distFolder));
});
