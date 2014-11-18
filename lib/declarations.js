var dts = require('dts-bundle');
var cmpout = require('component-consoler');
var async = require('async');
var path = require('path');
var fs = require('fs');
var os = require('os');

/*
 * If your component.json has a "typescript" file we create an 
 * external definition file for your component and place it there.
 */
function outputDeclarationFile(branch, manifest, done) {
    var outputFile = get_declaration_file(branch.node);
    var outputCache = branch.__tsc.outputCache;

    if (!outputFile) {
        cmpout.warn('typescript', 'no definition file generated');   
        return done();
    }

    async.waterfall([
        function() {
            var callback = arguments[arguments.length -1];
            writeOutputFiles(branch, outputCache, callback);
        },
        function() {
            // use dts-bundle to build the external definition file
            var main = path.join(branch.path, 'tmp', path.basename(change_extension(branch.node.main, "d.ts")));

            dts.bundle({
                name: branch.node.name,
                main: main,
                out: path.join(branch.path, outputFile),
                baseDir: path.dirname(main) // keep this path as 'high' as possible - dts-bundle uses an expensive glob
            });

            var callback = arguments[arguments.length -1];
            callback();
        },
        function() {
            var looseDefFiles = manifest.field.scripts
              .filter(function(script) {            
                return ends_with(script.path, '.d.ts');
              })
              .map(function(script) {
                return path.join(branch.path, script.path);
              });

            var callback = arguments[arguments.length -1];
            readFiles(looseDefFiles, callback);
        },
        function(loosedefs) {
            // append any loose definitions in the project folder
            var loosedef = loosedefs.reduce(function(current, def) {
                var defstext = strip_triple_comments(def);

                if (defstext.length > 0)
                    current += defstext + os.EOL; 

                return current;                
            }, "");

            outputFile = path.join(branch.path, outputFile);

            var callback = arguments[arguments.length -1];

            if (loosedef.length > 0)
                fs.appendFile(outputFile, loosedef, callback);
            else 
                callback(); 
        }
    ], function (err, result) {
        if (err)
            cmpout.log('typescript', 'error generating ' + path.join(branch.name, path.relative(branch.path, outputFile)) + ' [' + err.message +']');
        else
            cmpout.log('typescript', 'generated ' + path.join(branch.name, path.relative(branch.path, outputFile)));

        done();
    });
}

function writeOutputFiles(branch, outputCache, cb) {
    function writeFile(filename, cb) {
        var tmppath = path.join(branch.path, filename);
        ensure_directory(tmppath, function() {
            fs.writeFile(tmppath, outputCache[filename], cb);    
        });
    }

    var filelist = Object.keys(outputCache).filter(function(filename) {
        return ends_with(filename, ".d.ts");
    });

    async.map(filelist, writeFile, cb);
}

function readFiles(filelist, cb) {

    function readFile(filename, done) {
        fs.readFile(filename, { "encoding": "utf8" }, done);
    }

    async.map(filelist, readFile, cb);
}

function ensure_directory(filename, callback) {
    var dirname = path.dirname(filename);

    fs.exists(dirname, function (exists) {
        if (exists) return callback(null);

        var current = path.resolve(dirname);

        ensure_directory(current, 0766, function (err) {
            if (err) return callback(err);
            fs.mkdir(current, mode, function (err) {
                if (err) return callback(err);
                callback();
            });
        });
    });
}

function change_extension(file, ext) {
    return path.join(path.dirname(file), path.basename(file, path.extname(file)) + '.' + ext);
}

function starts_with(str, pref) {
    return (str.indexOf(pref) === 0);
}

function ends_with(str, post) {
    return str.lastIndexOf(post) + post.length === str.length;
}

function get_declaration_file(node) {
    if( node.typescript ) {
        if (typeof node.typescript == 'string' || node.typescript instanceof String)
            return node.typescript;
        else
            return node.typescript.definition;                    
    }  
    return undefined;
}

function strip_triple_comments(text) {
    var started = false;

    return text
        .replace(/\r\n/gm, "\n")
        .split("\n")        
        .reduce( function(current, line) {
            if (!starts_with(line, "///")) {  
                if ((line.length > 0) || started ) {
                    started = true;
                    current += line + os.EOL;
                }
            }
            return current;
        }, "");
}

module.exports = outputDeclarationFile;

