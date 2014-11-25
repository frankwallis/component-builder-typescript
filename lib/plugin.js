var fs = require('fs');
var path = require('path');
var async = require('async');

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
    }

    if (!Tsifier.isTypescript(file.path))
      return done();

    if (!file.branch.__tscInitialised ) {
      file.branch.__tscInitialised = true;
      compiler.compileBranch(file.branch, file.manifest);
      cmpout.log('typescript', 'compiled ' + file.branch.name);

      file.extension = 'js';
      file.string = compiler.getCompiledFile(path.join(file.branch.path, file.path));
      
      if (file.branch.type == 'local') {
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