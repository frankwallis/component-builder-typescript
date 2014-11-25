var fs = require('fs');
var path = require('path');
var async = require('async');

var outputDeclarations = require("./declarations");
var Compiler = require('./Compiler');
var compiler = new Compiler();

module.exports = function(options) {

  options = options || { compileLinkedComponents: false, gulp: false };  

  var cmpout = require('./logger')(options);

  return function(file, done) {
    if (Compiler.isTypescriptDeclaration(file.path)) {
      file.string = '';
      file.extension = 'js';
      return done();
    }

    if (!Compiler.isTypescript(file.path))
      return done();

    if (!file.branch.__tscInitialised ) {
      file.branch.__tscInitialised = true;
      compiler.compileBranch(file.branch, file.manifest, cmpout);

      file.extension = 'js';
      file.string = compiler.getCompiledFile(path.join(file.branch.path, file.path));
      
      if (file.branch.type == 'local1') {
        outputDeclarations(file.branch, file.manifest, compiler.getDeclarationFiles(), cmpout, done);
      }
      else {
        done();
      }    
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