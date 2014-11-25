var convert = require('convert-source-map');
var path    = require('path');
var flatten = require('component-flatten');

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

function Tsifier(opts) {
	opts = opts || {};
	this.opts = {
		module: 'commonjs',
		noImplicitAny: opts.noImplicitAny || false,
		removeComments: opts.removeComments || false,
		sourceMap: true,
		target: opts.target || opts.t || 'ES3',
		skipWrite: true,
		noResolve: true
	};
	this.host = new Host(process.cwd(), this.opts.target);
}

Tsifier.prototype.reset = function () {
	this.host._reset();
};

Tsifier.prototype.generateCache = function (files) {
	// var tsFiles = files
	// 	.filter(isTypescript)
	// 	.map(getRelativeFilename);

	// if (tsFiles.length === 0)
	// 	return;

	// this.addAll(tsFiles);
	// this.compile();
};

Tsifier.prototype.addAll = function (files) {
	var self = this;
	files.forEach(function (file) {
		self.host._addFile(file, true);
	});
};

Tsifier.prototype.add = function (files) {
	var self = this;
	self.host._addFile(file, true);
};

Tsifier.prototype.compileBranch = function (branch, manifest, cmpout, isLocal) {
	var self = this;

	var declarations = self.getDependencyDeclarations(branch);
	var scripts = self.getScripts(branch, manifest);

	var inputs = declarations.concat(scripts);

	console.log('Compiling ' + JSON.stringify(inputs))

	console.log('Compiling ' + branch.name);
	//rootFilenames.forEach(function (file) { console.log('  %s', file); });
	inputs.forEach(function (file) { self.host._addFile(file, true) });

	var program = ts.createProgram(inputs, self.opts, self.host);
	//time.stop(createProgram_t0, 'createProgram');

	//var diagnostics_t0 = time.start();
	var errors = program.getDiagnostics();
	if (!errors.length) {
		var checker = program.getTypeChecker(true);
		var semanticErrors = checker.getDiagnostics();
		var emitErrors = checker.emitFiles().errors;
		errors = semanticErrors.concat(emitErrors);
	}
	//time.stop(diagnostics_t0, 'diagnostic checking');

	//console.log('' + errors.length);
	console.log(JSON.stringify(Object.keys(self.host.output)));

	if (errors.length) {
		//errors.forEach(function (error) {
			//	console.log(error);
			
			//	console.log(JSON.stringify(new CompileError(error)));
			//  self.emit('error', new CompileError(error));
		//});

		console.log(JSON.stringify(new CompileError(errors[0])));
		self.host.error = true;
	}
}

Tsifier.prototype.getScripts = function (branch, manifest) {
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

Tsifier.prototype.getDependencyDeclarations = function(branch) {
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

			if (twig.node.typescript)
				defs.push(twig.node.typescript.definition);

			return filelist.concat(defs.map(function(def) {
				return path.join(twig.path, def);
			}));
		}, [])
		
	return dependencies;
}

// function getDependencies(branch) {
// 	var root = branch;
//     while(root.parent)
//     	root = root.parent;

// 	var branches = flatten(root);

// 	var dependencies = branches
// 		.filter(function(branch) {
// 			return branch.node.typescript && branch.node.typescript.definition;		
// 		})
// 		.map(function(branch) {
// 			//var normalized = ts.normalizePath(tsFile);
	
// 			return path.join(branch.path, branch.node.typescript.definition);
// 		})

// 	return dependencies;
// }

// Tsifier.prototype.compile = function (source, done) {
// 	var self = this;
// 	var rootFilenames = _(self.host.files).filter('root').map('filename').valueOf();

// 	console.log('Compiling files:');
// 	rootFilenames.forEach(function (file) { console.log('  %s', file); });

// 	//var createProgram_t0 = time.start();
// 	var program = ts.createProgram(rootFilenames, self.opts, self.host);
// 	//time.stop(createProgram_t0, 'createProgram');

// 	//var diagnostics_t0 = time.start();
// 	var errors = program.getDiagnostics();
// 	if (!errors.length) {
// 		var checker = program.getTypeChecker(true);
// 		var semanticErrors = checker.getDiagnostics();
// 		var emitErrors = checker.emitFiles().errors;
// 		errors = semanticErrors.concat(emitErrors);
// 	}
// 	//time.stop(diagnostics_t0, 'diagnostic checking');

// 	errors.forEach(function (error) {
// 		self.emit('error', new CompileError(error));
// 	});

// 	if (errors.length)
// 		self.host.error = true;
// };

Tsifier.prototype.getCompiledFile = function (tsFile) {
	var self = this;

	if (self.host.error)
		return;

	var normalized = ts.normalizePath(tsFile);
	var jsFile = tsToJs(normalized);

	var output = self.host.output[jsFile];
	if (!output) {
		console.log('Cache miss on %s', normalized);
		self.generateCache([tsFile]);
		if (self.host.error)
			return;
		output = self.host.output[jsFile];
		if (!output)
			return;
	}

	var sourcemap = convert.fromJSON(this.host.output[jsFile + '.map']);
	sourcemap.setProperty('sources', [normalized]);
	sourcemap.setProperty('sourcesContent', [self.host.files[normalized].contents]);
	return output.replace(convert.mapFileCommentRegex, sourcemap.toComment());
};

module.exports = Tsifier;
module.exports.isTypescript = isTypescript;
module.exports.isTypescriptDeclaration = isTypescriptDeclaration;
