var fs = require('fs');
var path = require('path');
var async = require('async');

var outputDeclarations = require('./declarations-sync');
var Compiler = require('./compiler');

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

    // ignore other non ts files
    if (!Compiler.isTypescript(file.path))
      return done();

    // compile each branch once, and one at a time ('fortunately' this is synchronous)
    if (!file.branch.__tsc || !file.branch.__tsc.initialised) {
      file.branch.__tsc.initialised = true;

      // do the compilation
      if (!compiler.compileBranch(file.branch, file.manifest, cmpout))
        return done(new Error('typescript compilation failed'))

      if (!generateDeclarations(file.branch, cmpout))
        return done(new Error('typescript unable to generate declaration file'));
    }

    // update the current file
    if (!compiler.updateFile(file, cmpout))
      return done(new Error('typescript compilation failed'));

    return done();      
  }

  function generateDeclarations (branch, cmpout) {
    // generate an external definition file for local or linked components
    if (options.generateDeclarations) {
      var stats = fs.lstatSync(branch.path);
      isLinked = stats && stats.isSymbolicLink();
      
      if ((branch.type == 'local') || isLinked)
        return outputDeclarations(branch, branch.__tsc.manifest, compiler.getDeclarationFiles(), cmpout);
    }
    return true;
  }
}