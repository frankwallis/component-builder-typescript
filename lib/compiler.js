var path = require('path');
var flatten = require('component-flatten');
var tsapi = require('typescript-compiler');
var host = new tsapi.CompositeCompilerHost();
host.writeToString();

host.addSource = function (nameOrContents, contents) {
    var source;
    if (typeof contents == 'undefined')
    	source = new tsapi.StringSource(nameOrContents);
    else
        source = new tsapi.StringSource(contents, nameOrContents);

   		console.log('here ' + nameOrContents + contents);
   if (path.basename(nameOrContents) == '_dependencies.d.ts') {
		source.contents = "";
   }

    this._sources[source.filename] = source.contents;
    return this;
};

function addDependencies(root) {
	var branches = flatten(root);

	var dependencies = branches
		.filter(function(branch) {
			return branch.node.typescript && branch.node.typescript.definition;		
		})
		.map(function(branch) {
			return branch.node.typescript.definition;
		})
		.forEach(function(defn) {
			host.addSource(defn);
		})
}

function compileBranch(branch, manifest, cmpout, isLocal) {

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
      settings.noResolve = true;
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

module.exports.addDependencies = addDependencies;
module.exports.compileBranch = compileBranch;
module.exports.compileJsFile = compileJsFile;
module.exports.compileTsFile = compileTsFile;
module.exports.updatePendingFiles = updatePendingFiles;
