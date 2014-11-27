var path    = require('path');
var log = require('debuglog')(require('../package').name);
var convert = require('convert-source-map');

var Host = require('./host');
var ts   = require('./tsc/tsc');

function isTypescript(file) {
	return (/\.ts$/i).test(file);
}

function isTypescriptDeclaration(file) {
	return (/\.d\.ts$/i).test(file);
}

function tsToJs(tsFile) {
	return tsFile.replace(/\.ts$/i, '.js');
}

function ends_with(str, post) {
    return str.lastIndexOf(post) + post.length === str.length;
}

function Compiler(opts, host) {
	opts = opts || {};
	this.opts = {
		module: 'commonjs',
		noImplicitAny: opts.noImplicitAny || false,
		removeComments: opts.removeComments || false,
		sourceMap: opts.sourceMap || true,
		declaration: opts.declaration || true,
		target: opts.target || opts.t || 'ES5',
		skipWrite: opts.skipWrite,
		noResolve: opts.noResolve,
		outDir: opts.outDir
	};

	this.host = host || new Host(process.cwd(), this.opts.target);
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

Compiler.prototype.filesChanged = function () {
	return this.host.filesChanged();
};

Compiler.prototype.compile = function (inputs, baseDir, cmpout) {
	var self = this;

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
		self.outputDiagnostic(errors[0], baseDir, cmpout);

		if (errors[0].category === 1 /* Error */)
			self.host.error = true;
	}
	else {
		self.host.cacheResults(baseDir);	
	}

	return !self.host.error; 
}

Compiler.prototype.outputDiagnostic = function (diag, baseDir, cmpout) {
	// feature: print the compiler output over 2 lines! file then message
	if (diag.file) {
	  var loc = diag.file.getLineAndCharacterFromPosition(diag.start);
	  var output = path.join(path.relative('../', baseDir, diag.file.filename)) + "(" + loc.line + "," + loc.character + "): ";

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

Compiler.prototype.getCompiledFile = function (outputPath) {
	var self = this;

	if (self.host.error)
		return;

	var outputPath = ts.normalizePath(outputPath);
	outputPath = tsToJs(outputPath);
	var output = self.host.cachedOutput[outputPath];

	if (!output) {
		return;
	}

	// inline
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

Compiler.prototype.getSourceMap = function (outputPath, inputPath) {
	var self = this;

	var inputPath = ts.normalizePath(inputPath);
	var outputPath = ts.normalizePath(outputPath);
	outputPath = tsToJs(outputPath);

	if (self.host.error)
		return;

	if (this.opts.sourceMap)
		return;

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

