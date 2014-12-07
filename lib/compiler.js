var path    = require('path');
var log = require('debuglog')(require('../package').name);
var convert = require('convert-source-map');

var Host = require('./caching-host');
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

function Compiler(host) {
	this.host = host || new Host();
}

Compiler.prototype.reset = function () {
	this.host._reset();
};

Compiler.prototype.addAll = function (files, target) {
	var self = this;

	files.forEach(function (filename) {
		file = self.add(filename, true);
	});
};

Compiler.prototype.add = function (file, target) {
	return this.host._addFile(file, target);
};

Compiler.prototype.filesChanged = function () {
	return this.host.filesChanged();
};

Compiler.prototype.compile = function (inputs, opts) {
	var self = this;

	tsopts = {
		module: 'commonjs',
		noImplicitAny: opts.noImplicitAny || false,
		removeComments: opts.removeComments || false,
		sourceMap: opts.sourceMap || false,
		declaration: opts.declaration || false,
		target: opts.target || opts.t || 'ES5',
		skipWrite: opts.skipWrite,
		noResolve: opts.noResolve,
		outDir: opts.outDir
	};

	log("Inputs: " + JSON.stringify(inputs));
	var program = ts.createProgram(inputs, tsopts, self.host);

	var errors = program.getDiagnostics();
	if (!errors.length) {
		var checker = program.getTypeChecker(true);
		var semanticErrors = checker.getDiagnostics();
		var emitErrors = checker.emitFiles().errors;
		errors = semanticErrors.concat(emitErrors);
	}

	log("Outputs: " + JSON.stringify(Object.keys(self.host.output)));

	if (!errors.length)
		self.host.cacheResults();

	return errors;
}

Compiler.prototype.getCompiledFile = function (inputPath, inlineSourceMap) {
	var self = this;

	var inputPath = ts.normalizePath(inputPath);
	outputPath = tsToJs(inputPath);

	var output = self.host.cachedOutput[outputPath];

	if (!output)
		return;

	if (inlineSourceMap) {
		var sourcemap = this.getSourceMap(inputPath);
		output = output.replace(convert.mapFileCommentRegex, sourcemap.toComment());
	}
	else {
		// strip out source urls
 		output = output.replace(convert.mapFileCommentRegex, '');
	}

	return output;
};

Compiler.prototype.getSourceMapJson = function (inputPath) {
	return this.getSourceMap(inputPath).toJSON();
}

Compiler.prototype.getSourceMap = function (inputPath) {
	var self = this;

	var inputPath = ts.normalizePath(inputPath);
	outputPath = tsToJs(inputPath);

	if (!self.host.cachedOutput[outputPath])
		return;

	//var relativePath = path.relative("C:/work/bitbucket/app/", inputPath)
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
module.exports.normalizePath = ts.normalizePath;