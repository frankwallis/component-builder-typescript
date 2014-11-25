var path    = require('path');
var log = require('debuglog')(require('../package').name);
var flatten = require('component-flatten');
var convert = require('convert-source-map');

var CompileError = require('./CompileError');
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

function getRelativeFilename(file) {
	return './' + path.relative(process.cwd(), file)
		.replace(/\\/g, '/');
}

function Compiler(opts) {
	opts = opts || {};
	this.opts = {
		module: 'commonjs',
		noImplicitAny: opts.noImplicitAny || false,
		removeComments: opts.removeComments || false,
		sourceMap: true,
		target: opts.target || opts.t || 'ES3',
		skipWrite: true,
		noResolve: true,
		declaration: true
		//,
	//	outDir: './tmp/'
		//,
		//sourceRoot: './src'
	};
	this.host = new Host(process.cwd(), this.opts.target);
}

Compiler.prototype.reset = function () {
	this.host._reset();
};

Compiler.prototype.addAll = function (files) {
	var self = this;

	files.forEach(function (filename) {
		file = self.host._addFile(filename, true);
	});
};

Compiler.prototype.add = function (files) {
	var self = this;
	self.host._addFile(file, true);
};

Compiler.prototype.compileBranch = function (branch, manifest, cmpout, isLocal) {
	var self = this;

	var declarations = self.getDependencyDeclarations(branch);
	var scripts = self.getScripts(branch, manifest);
	var inputs = declarations.concat(scripts);

	this.reset();
	this.addAll(inputs);

	if (self.host.filesChanged()) {
		log("Inputs: " + JSON.stringify(Object.keys(self.host.files)));
		cmpout.log('typescript', 'compiling ' + branch.name);

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

			if (errors[0].category === 1 /* Error */) {
				self.host.error = true;
			}
		}

		self.host.cacheResults();
	}
	else {
		cmpout.log('typescript', branch.name + ' unchanged');
	}
}

function outputDiagnostic(diag, branch, cmpout) {
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
	var root = branch;
    while(root.parent)
    	root = root.parent;

	var branches = flatten(root);

	var dependencies = branches
		.reduce(function(filelist, twig) {

			var defs = [];

			if (twig.node.files) {
				defs = defs.concat(twig.node.files.filter(function(file) {
					return isTypescriptDeclaration(file);
				}));
			}

			if (twig.node.scripts) {
				defs = defs.concat(twig.node.scripts.filter(function(script) {
					return isTypescriptDeclaration(script);
				}));
			}

			if (twig.node.typescript && twig.node.typescript.definition)
				defs.push(twig.node.typescript.definition);

			return filelist.concat(defs.map(function(def) {
				return path.join(twig.path, def);
			}));
		}, [])
		
	return dependencies;
}

Compiler.prototype.getCompiledFile = function (tsFile) {
	var self = this;

	if (self.host.error)
		return;

	var normalized = ts.normalizePath(tsFile);
	var jsFile = tsToJs(normalized);

	var output = self.host.cachedOutput[jsFile];

	if (path.basename(normalized) == 'authentication-events.ts')
		console.log('output: ' + output);

	if (!output) {
		return;
	}

	var sourcemap = convert.fromJSON(this.host.cachedOutput[jsFile + '.map']);
	sourcemap.setProperty('sources', [normalized]);
	sourcemap.setProperty('sourcesContent', [self.host.cachedInput[normalized].ts.text]);
	return output.replace(convert.mapFileCommentRegex, sourcemap.toComment());
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
