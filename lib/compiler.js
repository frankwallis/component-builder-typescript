var path    = require('path');
var log = require('debuglog')(require('../package').name);
var flatten = require('component-flatten');
var convert = require('convert-source-map');

var Host         = require('./Host');
var ts           = require('./tsc/tsc');

function isTypescript(file) {
	return (/\.ts$/i).test(file);
}

function isTypescriptDeclaration(file) {
	return (/\.d\.ts$/i).test(file);
}

function tsToJs(tsFile) {
	return tsFile.replace(/\.ts$/i, '.js');
}

function Compiler(opts) {
	opts = opts || {};
	this.opts = {
		module: 'commonjs',
		noImplicitAny: opts.noImplicitAny || false,
		removeComments: opts.removeComments || false,
		sourceMap: opts.generateSourceMaps || true,
		declaration: opts.generateDeclarations || true,
		target: opts.target || opts.t || 'ES5',
		skipWrite: true,
		noResolve: true, // we have everything we need.
		outDir: './tmp'  // redirect output for dts-bundle
	};

	this.host = new Host(process.cwd(), this.opts.target);
}

Compiler.prototype.reset = function () {
	this.host._reset();
};

Compiler.prototype.addAll = function (files) {
	var self = this;

	files.forEach(function (filename) {
		file = self.add(filename, true);
	});
};

Compiler.prototype.add = function (file) {
	return this.host._addFile(file, true);
};

Compiler.prototype.compileBranch = function (branch, manifest, cmpout, isLocal) {
	var self = this;

	var declarations = self.getDependencyDeclarations(branch);
	var scripts = self.getScripts(branch, manifest);
	var inputs = declarations.concat(scripts);

	this.reset();
	this.addAll(inputs);

	if (self.host.filesChanged() || branch.__tsc.needsCompile) {
		log("Inputs: " + JSON.stringify(Object.keys(self.host.files)));
		cmpout.log('typescript', 'compiling ' + branch.name);

		// trigger all our dependents to be compiled, this will cascade
		// all the way down the tree
		branch.dependents.forEach(function(dep) {
			dep.__tsc = dep.__tsc || {};
			dep.__tsc.needsCompile = true;
		})

		var program = ts.createProgram(inputs, self.opts, self.host);

		var errors = program.getDiagnostics();
		if (!errors.length) {
			var checker = program.getTypeChecker(true);
			var semanticErrors = checker.getDiagnostics();
			var emitErrors = checker.emitFiles().errors;
			errors = semanticErrors.concat(emitErrors);
		}

		log("Outputs: " + JSON.stringify(Object.keys(self.host.output)));

		if (errors.length) {
			outputDiagnostic(errors[0], branch, cmpout);

			if (errors[0].category === 1 /* Error */)
				self.host.error = true;
		}
		else {
			branch.__tsc.needsCompile = false;
			self.host.cacheResults(branch);	
		}
	}
	else {
		cmpout.log('typescript', branch.name + ' unchanged');
	}
}

function outputDiagnostic(diag, branch, cmpout) {
	// feature: print the compiler output over 2 lines! file then message
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

Compiler.prototype.getScripts = function (branch, manifest) {
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

Compiler.prototype.getDependencyDeclarations = function(branch) {
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

Compiler.prototype.updateFile = function (file) {
	file.extension = 'js';
	file.string = this.getCompiledFile(file.branch, file.path);
	file.sourceMap = this.getSourceMap(file.branch, file.path);
}

Compiler.prototype.getCompiledFile = function (branch, tsFile) {
	var self = this;

	if (self.host.error)
		return;

	var inputPath = ts.normalizePath(path.join(branch.path, tsFile));

	var outputPath = ts.normalizePath(path.join(branch.path, 'tmp', path.relative(path.dirname(branch.node.main), tsFile)));
	var outputPath = tsToJs(outputPath);

	var output = self.host.cachedOutput[outputPath];

	if (!output) {
		return;
	}

	// if (this.opts.sourceMap) {
	// 	var sourcemap = convert.fromJSON(this.host.cachedOutput[outputPath + '.map']);

	// 	var relativePath = path.relative("C:/work/bitbucket/app/", inputPath)

	// 	sourcemap.setProperty('sources', [relativePath]);
	// 	sourcemap.setProperty('sourcesContent', [self.host.cachedInput[inputPath].ts.text]);	
	// 	console.log(JSON.stringify(sourcemap));
	// 	output = output.replace(convert.mapFileCommentRegex, sourcemap.toComment());

	// }

	// strip out source urls
 	output = output.replace(convert.mapFileCommentRegex, '');
	return output;
};

Compiler.prototype.getSourceMap = function (branch, tsFile) {
	var self = this;

	if (self.host.error)
		return;

	if (this.opts.sourceMap)
		return;

	var inputPath = ts.normalizePath(path.join(branch.path, tsFile));

	var outputPath = ts.normalizePath(path.join(branch.path, 'tmp', path.relative(path.dirname(branch.node.main), tsFile)));
	var outputPath = tsToJs(outputPath);

	var output = self.host.cachedOutput[outputPath];

	if (!output) {
		return;
	}

	var sourcemap = convert.fromJSON(this.host.cachedOutput[outputPath + '.map']);
	sourcemap.setProperty('sources', [inputPath]);
	sourcemap.setProperty('sourcesContent', [self.host.cachedInput[inputPath].ts.text]);	
	
	return sourcemap;
};

Compiler.prototype.getDeclarationFiles = function () {
	var self = this;

	return Object.keys(self.host.output)
		.reduce(function(result, key) {
			result[key] = self.host.output[key];
			return result;
		}, {})
}

module.exports = Compiler;
module.exports.isTypescript = isTypescript;
module.exports.isTypescriptDeclaration = isTypescriptDeclaration;

