var fs = require('fs');
var log = require('debuglog')(require('../package').name);
var os = require('os');
var path = require('path');
var ts = require('./tsc/tsc');

var libDefault = ts.createSourceFile(
	'__lib.d.ts',
	fs.readFileSync(path.join(__dirname, './tsc/lib.d.ts'), 'utf-8'),
	ts.ScriptTarget.ES3,
	'0');

function tsToJs(tsFile) {
	return tsFile.replace(/\.ts$/i, '.js');
}

function Host() {
	this.files = {};
	this.cachedInput = {};
	this.cachedOutput = {};
	this.previousFiles = {};
	this.output = {};
	this.version = 0;
}

Host.prototype._reset = function () {
	var self = this;

	this.files = {};
	this.output = {};
	++this.version;

	log('Resetting (version %d)', this.version);
};

Host.prototype.filesChanged = function () {
	var self = this;
	var result = false;

	Object.keys(self.files).forEach(function(key) {
		if (self.files[key].changed) {
			log('file has changed (%s)', key);
			result = true;
		}
	});

	return result;
};

Host.prototype.cacheResults = function () {
	var self = this;

	// move all the just-compiled files to the cache
	Object.keys(self.output).forEach(function(key) {
		self.cachedOutput[key] = self.output[key];
	});
};

Host.prototype._addFile = function (filename, root, languageVersion) {
	var normalized = ts.normalizePath(filename);

	if (this.files[normalized]) 
		return this.files[normalized].file;

	stat = fs.statSync(filename);
	var mtime = stat.mtime;

	var file;
	var changed 

	if (this.cachedInput[normalized] && (this.cachedInput[normalized].mtime.getTime() == mtime.getTime())) {
		file = this.cachedInput[normalized].ts;
		log('Reused file %s (version %s)', normalized, file.version);
		changed = false;
	}
	else {
		var text;

		try {
			text = fs.readFileSync(filename, 'utf-8');
		} catch (ex) {
			cmpout.error('typescript', 'error reading ' + filename);
			return;
		}

		file = ts.createSourceFile(filename, text, this.languageVersion, this.version.toString());	
		log('New version of source file %s (version %s)', normalized, file.version);
		changed = true;
	}

	this.files[normalized] = {
		"filename": filename,
		"ts": file,
		"root": root,
		"mtime": mtime,
		"changed": changed
	};

	this.cachedInput[normalized] = this.files[normalized];
	return file;
};

Host.prototype.getNewLine = function () {
	return os.EOL;
};

Host.prototype.useCaseSensitiveFileNames = function () {
	var platform = os.platform();
	return platform !== 'win32' && platform !== 'win64' && platform !== 'darwin';
};

Host.prototype.getCurrentDirectory = function () {
	return this.currentDirectory;
};

Host.prototype.getCanonicalFileName = function (filename) {
	return ts.normalizePath(filename);
};

Host.prototype.getDefaultLibFilename = function () {
	return '__lib.d.ts';
};

Host.prototype.writeFile = function (filename, data) {
	this.output[filename] = data;
};

Host.prototype.getSourceFile = function (filename) {
	var normalized = ts.normalizePath(filename);

	if (this.files[normalized])
		return this.files[normalized].ts;

	if (normalized === '__lib.d.ts')
		return libDefault;

	return this._addFile(filename, false);
};

Host.prototype.getFileData = function(filename) {
	var normalized = ts.normalizePath(filename);
	return this.files[normalized];
};

module.exports = Host;
