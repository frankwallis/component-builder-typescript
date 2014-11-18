var gulp = require('gulp');
var gutil = require("gulp-util");

gulp.task('scripts', function () {
    var component = require('gulp-component-builder');
    var builder = require('component-builder');
    var typescript = require('./');
    
    return gulp.src('component.json')
        .pipe(component.scripts({ development: false }, function(scripts, option) {
            scripts.use('scripts', typescript());//, builder.plugins.js());
            scripts.use('json', builder.plugins.json());
            scripts.use('templates', builder.plugins.string());
        }))
       // .on('error', function(err) {
         //   gutil.log("Error " + err.message);
        //})
        .pipe(gulp.dest('build'));
});

gulp.task('specs', function () {
    var component = require('gulp-component-builder');
    var builder = require('component-builder');
    var typescript = require('./');
    var rename = require('gulp-rename');

    return gulp.src('component.json')
        .pipe(component.scripts({ development: false }, function(scripts, option) {
            scripts.use('specs', typescript(), builder.plugins.js());
        }))
        .on('error', function(err) {
            gutil.log("Error " + err.message);
        })
        .pipe(rename('build-specs'))
        //.pipe(concat(require all specs))
        .pipe(gulp.dest('build'));
});

gulp.task('files', function () {
    var component = require('gulp-component-builder');
    
    return gulp.src('component.json')
        .pipe(component.files({ development: false }))
        .on('error', function(err) {
            gutil.log("Error " + err.message);
        })
        .pipe(gulp.dest('build'))
});

gulp.task('styles', function () {
    var builder = require('component-builder');
    var autoprefix = require('builder-autoprefixer');
    
    var component = require('gulp-component-builder');
    var sass = require('component-builder-sass');
    
    return gulp.src('component.json')
        .pipe(component.styles({ development: false }, function(styles, option) {
            styles.use('styles', sass(), builder.plugins.urlRewriter(''), autoprefix());
        }))
        .on('error', function(err) {
            gutil.log("Error " + err.message);
        })
        .pipe(gulp.dest('build'));
});

gulp.task('watch-scripts', [ 'scripts' ], function () {
    var resolve = require("component-resolve-list");
    
    resolve.scripts(function(filelist) {
        gulp.watch(filelist, { read: false, debounceDelay: 500 }, [ 'scripts' ]);
    });
});

gulp.task('watch-styles', [ 'styles' ], function () {
    var resolve = require("component-resolve-list");
    
    resolve.styles(function(filelist) {
        gulp.watch(filelist, { read: false, debounceDelay: 500 }, [ 'styles' ]);
    });
});

gulp.task('watch-files', [ 'files' ], function () {
    var resolve = require("component-resolve-list");
    
    resolve.files(function(filelist) {
        gulp.watch(filelist, { read: false, debounceDelay: 500 }, [ 'files' ]);
    });
});

gulp.task('build', ['scripts', 'styles', 'files']);
gulp.task('watch', ['watch-scripts', 'watch-styles', 'watch-files']);
gulp.task('default', ['build']);