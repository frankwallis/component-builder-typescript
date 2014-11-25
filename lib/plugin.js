var fs = require('fs');
var path = require('path');
var async = require('async');

var outputDeclarations = require("./declarations");
var Compiler = require('./Compiler');

var compiler;

module.exports = function(options) {

  options = options || {};
  options.externalDeclaration = options.externalDeclaration || true;
  options.gulpMode = options.gulpMode || false;
  options.compileLinked = options.compileLinked || false;

  var cmpout = require('./logger')(options);

  if (!compiler)
    compiler = new Compiler(options);

  return function(file, done) {
    // set the manifest to the branch so we have access to the unglobbed
    // file lists in local components.
    file.branch.__tsc = file.branch.__tsc || {};
    file.branch.__tsc.manifest = file.manifest;

    // don't need to compile components which only have definition files
    if (Compiler.isTypescriptDeclaration(file.path)) {
      file.string = '';
      file.extension = 'js';
      return done();
    }

    // ignore non ts files
    if (!Compiler.isTypescript(file.path))
      return done();

    // compile each branch once, and one at a time ('fortunately' this is synchronous)
    if (!file.branch.__tsc || !file.branch.__tsc.initialised) {
      file.branch.__tsc.initialised = true;

      // do the compilation
      compiler.compileBranch(file.branch, file.manifest, cmpout);

      // update the current file
      file.extension = 'js';
      file.string = compiler.getCompiledFile(file.branch, file.path);
      
      // generate an external definition file for local or linked components
      if (options.externalDeclaration && (file.branch.type == 'local')) {
        outputDeclarations(file.branch, file.manifest, compiler.getDeclarationFiles(), cmpout, done);
      }
      else {
        done();
      }    
    }
    else {
      // branch is already compiled
      file.extension = 'js';
      file.string = compiler.getCompiledFile(file.branch, file.path);
      file.sourceMap = compiler.getSourceMap(file.branch, file.path);
      done();      
    }
  }
}