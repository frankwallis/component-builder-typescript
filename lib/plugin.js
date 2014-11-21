var fs = require('fs');
var path = require('path');
var async = require('async');
var tsapi = require('typescript-compiler');

var outputDeclarations = require("./declarations");
var outputDependencies = require("./dependencies");

var host = new tsapi.CompositeCompilerHost();
host.writeToString();

module.exports = function(options) {

  options = options || { compileLinkedComponents: false, gulp: false };  

  var cmpout = require('./logger')(options);

  return function(file, done) {
    if ((file.extension != 'ts') && (file.extension != 'js'))
      return done();

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
        file.branch.__tsc.pending.forEach(function(callback) {
          callback();
        });
      });
    }

    if((file.extension == 'ts') && !ends_with(file.path, ".d.ts")) {
      compileTsFile(file);
    }
    else if (file.extension == 'js') {
      compileJsFile(file);      
    }

    if (file.branch.__tsc.initialised)
      done();
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
          if (hasTypeScript && !isLinked)
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
        throw new Error("typescript compilation failed");

      cmpout.log("typescript", "compiled " + branch.name);
    }
  }

  function compileTsFile(file) {
    var rel = path.relative(path.dirname(file.branch.node.main), file.path);
    var jsFile = change_extension(path.join('tmp', rel), 'js');

    if (file.branch.__tsc.jsFileCache[jsFile])
        throw new Error("duplicate typescript/javascript files [" + path.basename(file.path) + ']' );
    else {
      file.branch.__tsc.tsFileCache[jsFile] = file;

      if (file.branch.__tsc.outputCache[jsFile]) {
        file.branch.__tsc.tsFileCache[jsFile].extension = 'js';
        file.branch.__tsc.tsFileCache[jsFile].string = file.branch.__tsc.outputCache[jsFile];        
      }
    }
  }

  function compileJsFile(file) {
    var rel = path.relative(path.dirname(file.branch.node.main), file.path);
    var jsFile = change_extension(path.join('tmp', rel), 'js');

    if (file.branch.__tsc) {
      if (file.branch.__tsc.tsFileCache[file.path])
        throw new Error("duplicate typescript/javascript files [" + path.basename(file.path) + ']' );
    }
  }

  function updatePendingFiles(branch) {
    Object.keys(branch.__tsc.tsFileCache).forEach(function(key) {
      var file = branch.__tsc.tsFileCache[key];

      if (branch.__tsc.outputCache[key]) {
        file.string = branch.__tsc.outputCache[key];
        file.extension = 'js';
      }
    });
  }

  function change_extension(file, ext) {
      return path.join(path.dirname(file), path.basename(file, path.extname(file)) + '.' + ext);
  }

  function ends_with(str, post) {
      return str.lastIndexOf(post) + post.length === str.length;
  }
}