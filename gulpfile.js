const concat = require('gulp-concat-util')
const del = require('del')
const gulp = require("gulp");
const gulpif = require('gulp-if')
const insert = require('gulp-insert')
const log = require('fancy-log')
const path = require('path')
const preprocess = require('gulp-preprocess')
const uglify = require('gulp-uglify')

global.distFolder = './dist'

// Clean previous install
function clean (cb) {
  return del([path.join(global.distFolder, '/**/*')])
}

// Install Assets
function copyHtml (cb) {
  return gulp
    .src(['./src/game/index.html'])
    .pipe(gulp.dest(global.distFolder))
}

function copyFonts () {
  return gulp
    .src(['./src/game/assets/fonts/*'])
    .pipe(gulp.dest(path.join(global.distFolder, '/fonts')))
}

function copyImages () {
  return gulp
    .src(['./src/game/assets/images/*'])
    .pipe(gulp.dest(path.join(global.distFolder, '/images')))
}

function copySfx () {
  return gulp
    .src(['./src/game/assets/sfx/*'])
    .pipe(gulp.dest(path.join(global.distFolder + '/sfx')))
}

function jsClient () {
  const list = [
    './src/common/Base.js',
    './src/common/*.js'
  ]

  return gulp.src(list)
    .pipe(preprocess({ context: { TARGET: global.target } }))
    .pipe(concat('gibson.min.js', { sep: ';' }))
    .pipe(insert.prepend([
      '/*! hack the gibson! / http://paulynomial.com */'
    ].join('\n')))
    .pipe(gulpif(global.production, uglify({
      mangle: false,
      preserveComments: 'license'
    }).on('error', log)))
    .pipe(gulp.dest(global.distFolder))
}

function jsVendor () {
  return gulp.src([
    './src/deps/async.min.js',
    './src/deps/jquery.min.js',
    './src/deps/stats.min.js',
    './src/deps/tween.min.js',
    './src/deps/underscore.min.js',

    './src/deps/three.min.js',
    './src/deps/threejs/js/controls/*.js',
    './src/deps/threejs/js/geometries/*.js',
    './src/deps/threejs/js/postprocessing/*.js',
    './src/deps/threejs/js/shaders/*.js',
    './src/deps/threejs/js/utils/*.js',
    './src/deps/threejs/js/vr/*.js'
  ])
    .pipe(concat('gibson-deps.min.js', { sep: ';' }))
    .pipe(insert.prepend([
      '/*! hack the gibson! / http://paulynomial.com */',
      '/*! three.js / threejs.org/license */',
      '/*! tween.js - http://github.com/sole/tween.js */'
    ].join('\n')))
    .pipe(uglify({
      mangle: false
    }))
    .pipe(gulp.dest(global.distFolder))
}

function webDebug (cb) {
  global.production = false
  return gulp.watch()
}

function webProd (cb) {
  global.production = true
  return cb()
}

/* Big Boy Build */
const build = gulp.series(
  clean,
  gulp.parallel(
    copyHtml,
    copyFonts,
    copyImages,
    copySfx
  ),
  jsClient,
  jsVendor,
  webProd
)

exports.clean = clean
exports.build = build
