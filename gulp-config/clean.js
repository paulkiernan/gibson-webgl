var gulp = require("gulp");
var del = require("del");

gulp.task("clean", function (cb) {
    if (global.target === "WEB") {
        return del([global.distFolder + "/**/*"]);
    }
});
