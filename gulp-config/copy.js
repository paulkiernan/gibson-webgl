var gulp = require("gulp");
var preprocess = require("gulp-preprocess");

gulp.task("copy-html", function () {
    return gulp.src([
            "./src/game/index.html",
        ])
        .pipe(preprocess({ context: { TARGET: global.target }}))
        .pipe(gulp.dest(global.distFolder));
});

gulp.task("copy", ["copy-html"], function () {
    gulp.src([
        "./src/game/assets/fonts/*"
    ])
    .pipe(gulp.dest(global.distFolder + "/fonts"));
    gulp.src([
        "./src/game/assets/images/*",
    ])
    .pipe(gulp.dest(global.distFolder + "/images"));
    gulp.src([
        "./src/game/assets/sfx/*",
    ])
    .pipe(gulp.dest(global.distFolder + "/sfx"));
});
