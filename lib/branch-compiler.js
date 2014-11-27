var fs = require('fs');
var path = require('path');

var flatten = require('component-flatten');
var log = require('debuglog')(require('../package').name);
var outputDeclarations = require('./declarations-sync');
var Compiler = require('./compiler');

var isTypescript = Compiler.isTypescript;
var isTypescriptDeclaration = Compiler.isTypescriptDeclaration;

function BranchCompiler(opts) {
	this.opts = opts;
	
	var tsopts = {
		module: 'commonjs',
		noImplicitAny: opts.noImplicitAny || false,
		removeComments: opts.removeComments || false,
		sourceMap: opts.generateSourceMaps || false,
		declaration: opts.generateDeclarations || true,
		target: opts.target || opts.t || 'ES5',
		skipWrite: true,
		noResolve: true, // we have everything we need.
		outDir: './tmp'  // redirect output for dts-bundle
	};

	this.compiler = new Compiler(tsopts);
}

BranchCompiler.prototype.compileBranch = function (branch, manifest, cmpout) {
	var self = this;

	var declarations = self.getDependencyDeclarations(branch);
	var scripts = self.getScripts(branch, manifest);
	var inputs = declarations.concat(scripts);
	inputs = inputs.filter(function(input) {
		return !self.shouldIgnoreFile(input, branch);
	});

	self.compiler.reset();
	self.compiler.addAll(inputs);

	if (self.compiler.filesChanged() || branch.__tsc.needsCompile) {
		log("Inputs: " + JSON.stringify(inputs));
		cmpout.log('typescript', 'compiling ' + branch.name);

		// trigger all our dependents to be compiled, this will cascade
		// all the way down the tree
		branch.dependents.forEach(function(dep) {
			dep.__tsc = dep.__tsc || {};
			dep.__tsc.needsCompile = true;
		})

		if (!self.compiler.compile(inputs, branch.path, cmpout))
			return false;
	
		if (!self.generateDeclarationFile(branch, cmpout))
			return false;

		branch.__tsc.needsCompile = false;
	}
	else {
		cmpout.log('typescript', branch.name + ' unchanged');
	}

	return true;
}

BranchCompiler.prototype.generateDeclarationFile = function (branch, cmpout) {
	// generate an external definition file for local or linked components
	if (this.opts.generateDeclarations) {
  		var stats = fs.lstatSync(branch.path);
  		isLinked = stats && stats.isSymbolicLink();
  
  		if ((branch.type == 'local') || isLinked)
    		return outputDeclarations(branch, branch.__tsc.manifest, this.compiler.getDeclarationFiles(), cmpout);
	}
	return true;
}

BranchCompiler.prototype.shouldIgnoreFile = function (path, branch) {
	return this.opts.ignoreFilesPattern && (branch.type != 'local') && this.opts.ignoreFilesPattern.test(path);
}

BranchCompiler.prototype.getScripts = function (branch, manifest) {
	var orderedScripts = manifest.field.scripts
		.filter(function(script) {
			return isTypescriptDeclaration(script.path);
		});

	orderedScripts = orderedScripts.concat(manifest.field.scripts
		.filter(function(script) {
			return isTypescript(script.path);
		}));

	orderedScripts = orderedScripts.map(function(script) {
		return path.join(branch.path, script.path);
	});

	return orderedScripts;
}

BranchCompiler.prototype.getDependencyDeclarations = function(branch) {
	var branches = flatten(branch);

	log(branch.name + " dependencies:");
	log(JSON.stringify(branches.map(function(branch){
		return branch.name;
	})));

	var dependencies = branches.slice(0, -1) // remove the last item 
		.reduce(function(filelist, twig) {

			if (twig.name == branch.name)
				throw new Error("Circular dependency: " + twig.name + " " + branch.name);

			var defs = [];

			// we receive the files in the correct order and set the manifest field
			// in plugin.js. So if the manifest is set then this component can safely be included
			if (twig.__tsc && twig.__tsc.manifest) {
				if (twig.__tsc.manifest.field.scripts) {
					defs = defs.concat(twig.__tsc.manifest.field.scripts.
						filter(function(script) {
							return isTypescriptDeclaration(script.path);
						}))
						.map(function(script){
							return script.path;
						});
				}

				if (twig.__tsc.manifest.field.files) {
					defs = defs.concat(twig.__tsc.manifest.field.files
						.filter(function(file1) {
							return isTypescriptDeclaration(file1.path);
						})
						.map(function(file2){
							return file2.path;
						}));
				}

				if (twig.node.typescript && twig.node.typescript.definition) {
					defs.push(twig.node.typescript.definition);
				}	
			}

			return filelist.concat(defs.map(function(def) {
				return path.join(twig.path, def);
			}));
		}, [])
		
	return dependencies;
}

BranchCompiler.prototype.updateFile = function (file, cmpout) {
	var inputPath = path.join(file.branch.path, file.path);
	var outputPath = path.join(file.branch.path, 'tmp', path.relative(path.dirname(file.branch.node.main), file.path));

	file.string = this.compiler.getCompiledFile(outputPath);

	if (!file.string) {
		if (this.shouldIgnoreFile(file.path, file.branch))
			return true;

		return false;
	}
	else {
		file.extension = 'js';
		file.sourceMap = this.compiler.getSourceMap(outputPath, inputPath);
		return true;
	}
}

module.exports = BranchCompiler;
module.exports.isTypescript = Compiler.isTypescript;
module.exports.isTypescriptDeclaration = Compiler.isTypescriptDeclaration;
