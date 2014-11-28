var Compiler = require('./branch-compiler');

// singleton
var compiler;

module.exports = function(options) {

  options = options || {};
  options.declaration = options.declaration || true;
  options.sourceMap = options.sourceMap || false;
  options.inlineSourceMap = options.inlineSourceMap || false;
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
        return done(new Error('typescript compilation failed(1)'))
    }

    // update the current file
    if (!compiler.updateFile(file, cmpout))
      return done(new Error('typescript compilation failed(2)'));

    return done();      
  }
}