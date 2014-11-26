var gulp = require('gulp');
var gutil = require("gulp-util");

gulp.task('scripts-gulp', function () {
    var component = require('gulp-component-builder');
    var builder = require('component-builder');
    var typescript = require('./');
    
    return gulp.src('component.json')
        .pipe(component.scripts({ development: false }, function(scripts, option) {
            scripts.use('scripts', typescript({ 'gulpMode': true }), builder.plugins.js());
            scripts.use('json', builder.plugins.json());
            // NEEDED FOR COMPONENT-BUILDER-TYPESCRIPT (EXTERNAL DECLARATIONS)
            scripts.use('files', function(file, done) { return done(); })
            //\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
            scripts.use('templates', builder.plugins.string());
        }))
        .on('error', function(err) {
           gutil.log("Error " + err.message);
        })
        .pipe(gulp.dest('build'));
});

gulp.task('scripts-component', [ 'scripts-gulp' ], function (cb) {
    var fs = require('fs');
    var resolve = require('component-resolver');
    var builder = require('component-builder');
    var typescript = require('./');
  
    // resolve the dependency tree
    resolve(process.cwd(), {
      // install the remote components locally
      install: true
    }, function (err, tree) {
      if (err) throw err;

      // only include `.js` files from components' `.scripts` field
      builder.scripts(tree)
        .use('scripts', typescript({ gulp: false }), builder.plugins.js())
        .use('json', builder.plugins.json())
        .use('templates', builder.plugins.string())
        // NEEDED FOR COMPONENT-BUILDER-TYPESCRIPT (EXTERNAL DECLARATIONS)
        .use('files', function(file, done) { return done(); })
        //\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\//\\
        .end(function (err, string) {
          if (err) throw err;
          fs.writeFile('build/build_1.js', string, cb);
        });
    })
});

gulp.task('watch-scripts', [ 'scripts' ], function () {
    var resolve = require("component-resolve-list");
    
    resolve.scripts(function(filelist) {
        gulp.watch(filelist, { read: false, debounceDelay: 500 }, [ 'scripts' ]);
    });
});

gulp.task('scripts', ['scripts-component', 'scripts-gulp']);
gulp.task('watch', ['watch-scripts']);
gulp.task('default', ['scripts']);