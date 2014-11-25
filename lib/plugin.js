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

      compiler.compileBranch(file.branch, file.manifest);
      console.log('done compiling');
      file.branch.__tsc.initialised = true;
    }

    if((file.extension == 'ts') && !ends_with(file.path, ".d.ts")) {
        file.extension = 'js';
        file.string = compiler.getCompiledFile(path.join(file.branch.path, file.path));
    }

    if (file.branch.__tsc.initialised)
      done();
    else
      file.branch.__tsc.pending.push(done);
  }

  function change_extension(file, ext) {
      return path.join(path.dirname(file), path.basename(file, path.extname(file)) + '.' + ext);
  }

  function ends_with(str, post) {
      return str.lastIndexOf(post) + post.length === str.length;
  }
}