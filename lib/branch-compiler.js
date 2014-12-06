var fs = require('fs');
var path = require('path');

var flatten = require('component-flatten');
var log = require('debuglog')(require('../package').name);
var outputDeclarations = require('./declarations-sync');
var Compiler = require('./compiler');

var isTypescript = Compiler.isTypescript;
var isTypescriptDeclaration = Compiler.isTypescriptDeclaration;

function BranchCompiler(opts) {
	this.opts = {
		noImplicitAny: opts.noImplicitAny || false,
		removeComments: opts.removeComments || false,
		sourceMap: opts.sourceMap || false,
		inlineSourceMap: opts.inlineSourceMap || false,
		declaration: opts.declaration || true,
		target: opts.target || opts.t || 'ES5',
		ignoreRemoteFilesRx: opts.ignoreRemoteFilesRx || false,
		fields: opts.fields || [ "scripts" ]
	};
	this.compiler = new Compiler();
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
	self.compiler.addAll(inputs, this.opts.target);

	if (self.compiler.filesChanged() || branch.__tsc.needsCompile) {
		cmpout.log('typescript', 'compiling ' + branch.node.name);

		// trigger all our dependents to be compiled, this will cascade
		// all the way down the tree
		branch.dependents.forEach(function(dep) {
			dep.__tsc = dep.__tsc || {};
			dep.__tsc.needsCompile = true;
		})
		var tsopts = {
			module: 'commonjs',
			noImplicitAny: !!self.opts.noImplicitAny,
			removeComments: !!self.opts.removeComments,
			sourceMap: !!self.opts.sourceMap || !!self.opts.inlineSourceMap,
			declaration: !!self.opts.declaration,
			target: self.opts.target || opts.t || 'ES5',
			skipWrite: true,
			noResolve: true // we have everything we need.
		};

		var errors = self.compiler.compile(inputs, tsopts);
	
		if (errors.length) {
			if (errors[0].category === 1 /* Error */)
				branch.__tsc.error = true;

			self.outputDiagnostics(branch, errors, cmpout);
			return false;
		}
	
		if (this.opts.declaration) {
			if (!self.generateDeclarationFile(branch, cmpout))
				return false;
		}

		branch.__tsc.needsCompile = false;
	}
	else {
		cmpout.log('typescript', branch.name + ' unchanged');
	}

	return true;
}

BranchCompiler.prototype.outputDiagnostics = function (branch, diags, cmpout) {
	diags.slice(0, 10).forEach(function(diag) {
		// feature: print the compiler output over 2 lines! file then message
		if (diag.file) {
		  var loc = diag.file.getLineAndCharacterFromPosition(diag.start);
		  var filename = Compiler.normalizePath(path.join(branch.node.name, path.relative(branch.path, diag.file.filename)));
		  var output = filename + "(" + loc.line + "," + loc.character + "): ";

		  if (diag.category === 1)
		    cmpout.error('typescript', output)
		  else
		    cmpout.warn('typescript', output)
		}

		if (diag.category === 1)
		  cmpout.error('typescript', diag.messageText + " (TS" + diag.code + ")");
		else
		  cmpout.warn('typescript', diag.messageText + " (TS" + diag.code + ")");
	});
}

BranchCompiler.prototype.generateDeclarationFile = function (branch, cmpout) {
	// generate an external definition file for local or linked components
	var stats = fs.lstatSync(branch.path);
	isLinked = stats && stats.isSymbolicLink();

	if ((branch.type == 'local') || isLinked)
		return outputDeclarations(branch, branch.__tsc.manifest, this.compiler.getDeclarationFiles(), cmpout);
	else
		return true;
}

BranchCompiler.prototype.shouldIgnoreFile = function (path, branch) {
	return this.opts.ignoreRemoteFilesRx && (branch.type != 'local') && this.opts.ignoreRemoteFilesRx.test(path);
}

BranchCompiler.prototype.getScripts = function (branch, manifest) {

	var unorderedScripts = [];

	this.opts.fields.forEach(function(fieldname) {
		if (manifest.field[fieldname]) {
			unorderedScripts = orderedScripts.concat(manifest.field[fieldname]
				.filter(function(script) {
					return isTypescript(script.path) || isTypescriptDeclaration(script.path);
				}));
		}
	})

	unorderedScripts = unorderedScripts.map(function(script) {
		return script.filename;
	});

	return unorderedScripts;
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
				throw new Error("circular dependency: " + twig.name + " " + branch.name);

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
							return script.filename;
						});
				}

				if (twig.__tsc.manifest.field.files) {
					defs = defs.concat(twig.__tsc.manifest.field.files
						.filter(function(file1) {
							return isTypescriptDeclaration(file1.path);
						})
						.map(function(file2){
							return file2.filename;
						}));
				}

				if (twig.node.typescript && twig.node.typescript.definition) {
					defs.push(path.join(twig.path, twig.node.typescript.definition));
				}	
			}

			return filelist.concat(defs);
		}, [])
		
	return dependencies;
}

BranchCompiler.prototype.updateFile = function (file, cmpout) {
	var self = this;

	file.string = self.compiler.getCompiledFile(file.filename, self.opts.inlineSourceMap);

	if (!file.string) {
		if (self.shouldIgnoreFile(file.path, file.branch))
			return true;
		
		if (!file.branch.__tsc.error)
			cmpout.error('typescript', path.join(file.branch.node.name, file.path) + ' was not compiled');
		
		return false;
	}
	else {
		file.extension = 'js';

		if (self.opts.sourceMap && !self.opts.inlineSourceMap)
			file.sourceMap = self.compiler.getSourceMapJson(file.filename);

		return true;
	}
}

module.exports = BranchCompiler;
module.exports.isTypescript = Compiler.isTypescript;
module.exports.isTypescriptDeclaration = Compiler.isTypescriptDeclaration;
