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
    if (Compiler.isTypescriptDeclaration(file.path)) {
      file.string = '';
      file.extension = 'js';
      return done();
    }

    if (!Compiler.isTypescript(file.path))
      return done();

    if (!file.branch.__tscInitialised) {
      file.branch.__tscInitialised = true;
      compiler.compileBranch(file.branch, file.manifest, cmpout);

      file.extension = 'js';
      file.string = compiler.getCompiledFile(file.branch, file.path);
      
      if (options.externalDeclaration && (file.branch.type == 'local')) {
        outputDeclarations(file.branch, file.manifest, compiler.getDeclarationFiles(), cmpout, done);
      }
      else {
        done();
      }    
    }
    else {
      file.extension = 'js';
      file.string = compiler.getCompiledFile(file.branch, file.path);
      file.sourceMap = compiler.getSourceMap(file.branch, file.path);
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