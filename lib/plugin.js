var fs = require('fs');
var path = require('path');
var cmpout = require('component-consoler');
var tsapi = require('typescript-compiler');
var outputDefinitionFile = require("./definitions");

var host = new tsapi.CompositeCompilerHost();
host.writeToString();

module.exports = function(options) {

  return function(file, done) {
    compileBranch(file.branch, file.manifest);

    if((extension(file.path) == 'ts') && !(ends_with(file.path, '.d.ts'))){
      compileFile(file);
    }
    else if (extension(file.path) == 'js') {
      if (file.branch.__tsc) {
        if (file.branch.__tsc.tsFileCache[file.path]) {
          file.branch.__tsc.tsFileCache[file.path].string = file.branch.__tsc.outputCache[jsFile];
          file.branch.__tsc.tsFileCache[file.path].extension = '';
          file.branch.__tsc.tsFileCache[file.path].path = jsFile;
        }
        else if (file.branch.__tsc.jsFileCache[file.path]) {
          file.string = file.branch.__tsc.jsFileCache[file.path];
        }
        else {
          file.branch.__tsc.jsFileCache[file.path] = file;
        }
      }
    }

    return done();
  }; 
}

function compileFile(file) {
    var rel = path.relative(path.dirname(file.branch.node.main), file.path);
    var jsFile = change_extension(path.join('tmp', rel), '.js');

    if (file.branch.__tsc.jsFileCache[jsFile])
      file.branch.__tsc.jsFileCache[jsFile].string = file.branch.__tsc.outputCache[jsFile];
    else {
      file.branch.__tsc.tsFileCache[jsFile] = file;
      file.branch.__tsc.tsFileCache[jsFile].string = file.branch.__tsc.outputCache[jsFile];
      file.branch.__tsc.tsFileCache[jsFile].extension = 'js';
    }
}

function compileBranch(branch, manifest) {
  if (!branch.__tsc) {
    branch.__tsc = {
      jsFileCache: {},
      tsFileCache: {},
      outputCache: {},
      hasErrors: false
    }

    // feature: run a full diagnostic on local components and linked components
    var stats = fs.lstatSync(branch.path);
    var isLocal = stats.isSymbolicLink() || (branch.type == 'local');

    // var dtsfiles = branches.filter(function(branch) {
    //     return is_typecript_dependency(branch);
    // })
    // .map(function(branch) {
    //     return path.join(branch.path, get_definition(branch.node)); 
    // });

    var tsscripts = manifest.field.scripts
      .filter(function(script) {            
        return extension(script.path) == 'ts';
      })
      .map(function(script) {
        return { "filename": path.join(branch.path, script.path) };
      })

    if (tsscripts.length > 0) {
      var settings = {};
      var handleErr = undefined;

      if (isLocal) {
        settings.fullTypeCheckMode = true;  
        handleErr = handleDiagnostic;
      } else {
        settings.fullTypeCheckMode = false;  
        handleErr = undefined;            
      }

      function handleDiagnostic(diag) {

        if (diag.category === 1 /* Error */) {
          branch.__tsc.hasErrors = true;
        }

        // feature: print the compiler output over 2 lines: file then message
        if (diag.file) {
          var loc = diag.file.getLineAndCharacterFromPosition(diag.start);
          var output = diag.file.filename + "(" + loc.line + "," + loc.character + "): ";

          if (diag.category === 1)
            cmpout.error('typescript', output)
          else
            cmpout.warn('typescript', output)
        }

        if (diag.category === 1)
          cmpout.error('typescript', diag.messageText + " (TS" + diag.code + ")");
        else
          cmpout.warn('typescript', diag.messageText + " (TS" + diag.code + ")");
      }
    
      function handleOutput(filename, output) {
        var rel = path.relative(branch.path, filename);
        branch.__tsc.outputCache[rel] = output;            
      }

      console.log("Compiling " + branch.name);
      console.log("Compiling " + JSON.stringify(tsscripts));

      host.redirectOutput(handleOutput);
      tsapi.compileWithHost(host, tsscripts, '-m commonjs -t es5 -d -outDir ' + path.join(branch.path, 'tmp'), settings, handleErr);

      var tsdefs = manifest.field.scripts
        .filter(function(script) {            
          return ends_with(script.path, '.d.ts');
        })
        .map(function(script) {
          return script.path;
        });

      if(branch.__tsc.hasErrors)
        throw new Error("TypeScript compilation failed");
      else
        outputDefinitionFile(branch, branch.__tsc.outputCache, tsdefs);
    }
  }
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

function ends_with(str, post) {
    return str.lastIndexOf(post) + post.length === str.length;
}