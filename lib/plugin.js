var fs = require('fs');
var path = require('path');
var async = require('async');
var tsapi = require('typescript-compiler');
var gutil = require('gulp-util');

var outputDeclarations = require("./declarations");
var outputDependencies = require("./dependencies");
var Tsifier = require('./Tsifier');
var compiler = new Tsifier();

module.exports = function(options) {

  options = options || { compileLinkedComponents: false, gulp: false };  

  var cmpout = require('./logger')(options);

  return function(file, done) {
    if (Tsifier.isTypescriptDeclaration(file.path)) {
      file.string = '';
      file.extension = 'js';
      return done();

    var err1 = undefined;

    if (!file.branch.__tsc) {
      file.branch.__tsc = {
        jsFileCache: {},
        tsFileCache: {},
        outputCache: {},
        hasErrors: false,
        pending: [],
        initialised: false
      }

      var root = file.branch;
      while(root.parent)
        root = root.parent;

      initialiseBranch(root, file.branch, file.manifest, function(err) {
        file.branch.__tsc.initialised = true;
        updatePendingFiles(file.branch);

        var err1 = undefined;

        if (file.branch.__tsc.hasErrors)
          err1 = new Error("typeccript compilation failed");

        file.branch.__tsc.pending.forEach(function(callback) {
          callback(err1);
        });
      });
    }

    if((file.extension == 'ts') && !ends_with(file.path, ".d.ts")) {
      compileTsFile(file);
    }
    else if (file.extension == 'js') {
      compileJsFile(file);      
    }

    if (file.branch.__tsc.initialised) {
      if (file.branch.__tsc.hasErrors)
        done(new Error("typescript compilation failed"))
      else
        done();
    }
    else
      file.branch.__tsc.pending.push(done);
  }

  function initialiseBranch(root, branch, manifest, done) {
   
    var isLocal = (branch.type == 'local');
    var isLinked = false;

    var hasTypeScript = manifest.field.scripts
      .some(function(script) {            
        return script.extension == 'ts';
      });

    async.series([
        function(callback) {
          // feature: run a full compile on linked components
          fs.lstat(branch.path, function(err, stats) {
            isLinked = stats && stats.isSymbolicLink();
            callback();
          });
        },
        function(callback) {
          if (hasTypeScript)// && !isLinked)
            outputDependencies(root, branch, manifest, cmpout, callback);
          else 
            callback();
        },
        function(callback) {
          if (hasTypeScript) {
            compileBranch(branch, manifest, isLocal);
            callback();
          }
          else {
            callback();
          }
        },
        function(callback) {
          if (isLocal && hasTypeScript)
            outputDeclarations(branch, manifest, cmpout, callback)
          else 
            callback();
        },
      ], done);
  }

  function compileBranch(branch, manifest, isLocal) {

    var tsSource = manifest.field.scripts
      .filter(function(script) {       
        // TODO - fix this
        return (path.extname(script.path) == '.ts') && (isLocal || !ends_with(script.path, 'spec.ts'));
      })
      .map(function(script) {
        return { "filename": path.join(branch.path, script.path) };
      })

    if (tsSource.length > 0) {
      var settings = {};
      var handleErr = undefined;

      // if (isLocal) {
      //   settings.fullTypeCheckMode = true;  
      //   handleErr = handleDiagnostic;
      // } else {
      //   settings.fullTypeCheckMode = false;  
      //   handleErr = undefined;            
      // }

      settings.fullTypeCheckMode = true;  
      handleErr = handleDiagnostic;

      function handleDiagnostic(diag) {

        if (diag.category === 1 /* Error */) {
          branch.__tsc.hasErrors = true;
        }

        // feature: print the compiler output over 2 lines: file then message
        if (diag.file) {
          var loc = diag.file.getLineAndCharacterFromPosition(diag.start);
          var output = path.join(branch.name, path.relative(branch.path, diag.file.filename)) + "(" + loc.line + "," + loc.character + "): ";
>>>>>>> 749af0c77889104ab7d1be7a4bab48f5708944fa

    if (!file.branch.__tscInitialised ) {
      file.branch.__tscInitialised = true;
      compiler.compileBranch(file.branch, file.manifest);
      cmpout.log('typescript', 'compiled ' + file.branch.name);

      file.extension = 'js';
      file.string = compiler.getCompiledFile(path.join(file.branch.path, file.path));
      
      if (file.branch.type == 'local') {
        outputDeclarations(file.branch, file.manifest, compiler.getDeclarationFiles(), cmpout, done);
      }
<<<<<<< HEAD
      else {
        done();
      }    
=======
    
      function handleOutput(filename, output) {
        var rel = path.relative(branch.path, filename);
        branch.__tsc.outputCache[rel] = output;            
      }

      if (settings.fullTypeCheckMode)
        cmpout.log("typescript", "compiling " + branch.name);
      else
        cmpout.log("typescript", "compiling " + branch.name + " (with no type-checking)");

      host.redirectOutput(handleOutput);

      var cmdargs = '-m commonjs -t es5 ' + ' -outDir ' + path.join(branch.path, 'tmp');

      // output to /tmp as we need to write the declaration files for dts-bundle
      if (isLocal)
        cmdargs = cmdargs + ' -d';

      tsapi.compileWithHost(host, tsSource, cmdargs, settings, handleErr);

      if(branch.__tsc.hasErrors)
        cmpout.error("typescript", "compiling " + branch.name + " failed");
      else
        cmpout.log("typescript", "compiled " + branch.name);
>>>>>>> 749af0c77889104ab7d1be7a4bab48f5708944fa
    }
    else {
      file.extension = 'js';
      file.string = compiler.getCompiledFile(path.join(file.branch.path, file.path));
      done();      
    }
  }

  function change_extension(file, ext) {
      return path.join(path.dirname(file), path.basename(file, path.extname(file)) + '.' + ext);
  }

  function ends_with(str, post) {
      return str.lastIndexOf(post) + post.length === str.length;
  }
}