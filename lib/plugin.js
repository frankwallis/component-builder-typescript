var fs = require('fs');
var path = require('path');
var async = require('async');

var outputDeclarations = require("./declarations");
var Compiler = require('./Compiler');

// singleton
var compiler;

module.exports = function(options) {

  options = options || {};
  options.generateDeclarations = options.generateDeclarations || true;
  options.generateSourceMaps = options.generateSourceMaps || false;
  options.gulpMode = options.gulpMode || false;
  
  var cmpout = require('./logger')(options);

  if (!compiler)
    compiler = new Compiler(options);

  return function(file, done) {
    // set the manifest to the branch so we have access to the unglobbed
    // file lists in local components.
    file.branch.__tsc = file.branch.__tsc || {};
    file.branch.__tsc.manifest = file.manifest;

    // don't need to compile components which only have declaration files
    if (Compiler.isTypescriptDeclaration(file.path)) {
      file.string = false;
      return done();
    }

    // ignore non ts files
    if (!Compiler.isTypescript(file.path))
      return done();

    // compile each branch once, and one at a time ('fortunately' this is synchronous)
    if (!file.branch.__tsc || !file.branch.__tsc.initialised) {
      file.branch.__tsc.initialised = true;

      // do the compilation
      if (!compiler.compileBranch(file.branch, file.manifest, cmpout))
        return done(new Error('typescript compilation failed'))

      // update the current file
      if (!compiler.updateFile(file, cmpout))
        return done(new Error('typescript compilation failed'));

      postCompile(file.branch, done);
    }
    else {
      // branch is already compiled
      if (!compiler.updateFile(file, cmpout))
        return done(new Error('typescript compilation failed'));

      done();      
    }
  }

  function postCompile(branch, done) {
    fs.lstat(branch.path, function(err, stats) {
      isLinked = stats && stats.isSymbolicLink();

      // generate an external definition file for local or linked components
      if (options.generateDeclarations && ((branch.type == 'local') || isLinked)) {
        outputDeclarations(branch, branch.__tsc.manifest, compiler.getDeclarationFiles(), cmpout, done);
      }
      else {
        done();
      }    
    });
  }
}