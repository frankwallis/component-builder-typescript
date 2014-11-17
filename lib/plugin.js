var path = require('path');
var cmpout = require('component-consoler');
var tsapi = require('typescript-compiler');

module.exports = function(options) {
	 
  var host = new tsapi.CompositeCompilerHost();
  host.writeToString();

  var jsFileCache = {};
  var tsFileCache = {};
  var outputCache = {};

  return function(file, done) {
    if(file.branch.type != 'local')
      return done();

    if(extension(file.path) == 'ts') {
  
      if (!file.branch.__tsc) {
        file.branch.__tsc = true;

        // var dtsfiles = branches.filter(function(branch) {
        //     return is_typecript_dependency(branch);
        // })
        // .map(function(branch) {
        //     return path.join(branch.path, get_definition(branch.node)); 
        // });

        var tsscripts = file.manifest.field.scripts;

        tsscripts = tsscripts
          .filter(function(script) {            
            return extension(script.path) == 'ts';
          })
          .map(function(script) {
            return { "filename": path.join(file.branch.path, script.path) };
          })

        if (tsscripts.length > 0) {
          var settings = {};
          settings.fullTypeCheckMode = true;

          var hasErrors = false;
        
          host.redirectOutput(function (filename, js) {
            var rel = path.relative(file.branch.path, filename);
            outputCache[rel] = js;
          });
   
          tsapi.compileWithHost(host, tsscripts, '-m commonjs -t es5', settings, function(err) {
             //for (var prop in err)
               //  console.log(prop + ': ' + err[prop]);
             hasErrors = true;
             cmpout.log('typescript', 'resolution failed...' + JSON.stringify(err), '33');
          });
        }
      }

      var jsFile = change_extension(file.path, '.js');
     
      if (jsFileCache[jsFile])
        jsFileCache[jsFile].string = outputCache[jsFile];
      else {
        tsFileCache[jsFile] = file;
        tsFileCache[jsFile].string = outputCache[jsFile];
        tsFileCache[jsFile].extension = 'js';
      }
    }
    else if (extension(file.path) == 'js') {
      if (tsFileCache[file.path]) {
        tsFileCache[file.path].string = outputCache[jsFile];
        tsFileCache[file.path].extension = '';
        tsFileCache[file.path].path = jsFile;
      }
      else if (jsFileCache[file.path]) {
        file.string = jsFileCache[file.path];
      }
      else {
        jsFileCache[file.path] = file;
      }
    }

    return done();
  }; 
}

function is_typecript_dependency(branch) {
    return (get_definition(branch.node) && (branch.type != 'local'))
}

function extension(pathname) {
  return path.extname(pathname).slice(1);
}
function change_extension(file, ext) {
    return path.join(path.dirname(file), path.basename(file, path.extname(file)) + ext);
}
