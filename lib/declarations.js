var dts = require('dts-bundle');
var async = require('async');
var path = require('path');
var fs = require('fs');
var os = require('os');
var prependFile = require('prepend-file');

/*
 * If your component.json has a "typescript.definition" entry we create an 
 * external definition file for your component and place it there.
 */
function outputDeclarationFile(branch, manifest, outputCache, cmpout, done) {
    var outputFile = get_declaration_file(branch.node);

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
            //var main = path.join(branch.path, 'tmp', path.basename(change_extension(branch.node.main, "d.ts")));
            var main = path.join(branch.path, 'tmp', change_extension(path.basename(branch.node.main), "d.ts"));

            // unfortunately this is synchronous
            dts.bundle({
                name: branch.node.name,
                main: main,
                out: path.join(branch.path, outputFile),
                baseDir: path.dirname(main) // keep this path as 'deep' as possible - dts-bundle uses an expensive glob
            });

            var callback = arguments[arguments.length -1];
            callback();
        },
        function() {
            var header = "/// ------------------------------------- ///" + os.EOL;
            header    += "/// Automatically generated. DO NOT EDIT. ///" + os.EOL;
            header    += "/// ------------------------------------- ///" + os.EOL + os.EOL;

            var text = manifest.field.scripts
              .filter(function(script) {            
                return ends_with(script.path, '.d.ts');
              })
              .reduce(function(current, script) {
                var dtsfile = path.join(branch.path, script.path);

                var basename = path.basename(script.path);

                if ((basename != '_references.d.ts') &&
                    (basename != '_dependencies.d.ts')) {

                    current += '/// <reference path="';
                    current += forward_slash( path.relative(path.dirname(outputFile), dtsfile) );
                    current += '" />' + os.EOL;
                }

                return current;
              }, header) + os.EOL;

            var callback = arguments[arguments.length -1];
            if (text.length > 0)
                prependFile(outputFile, text, function() {
                    callback();
                });
            else 
                callback(); 
        }
    ], function (err, result) {
        if (err)
            cmpout.log('typescript', 'error generating ' + forward_slash(path.join(branch.name, path.relative(branch.path, outputFile))) + ' [' + err.message +']');
        else
            cmpout.log('typescript', 'generated ' + forward_slash(path.join(branch.name, path.relative(branch.path, outputFile))));

        done();
    });
}

function writeOutputFiles(branch, outputCache, cb) {
    function writeFile(filename, cb) {
        ensure_directory(filename, function() {
            fs.writeFile(filename, outputCache[filename], cb);    
        });
    }

    var filelist = Object.keys(outputCache).filter(function(filename) {
        return ends_with(filename, ".d.ts");
    });

    async.map(filelist, writeFile, cb);
}

function ensure_directory(filename, callback) {
    var dirname = path.dirname(filename);

    fs.exists(dirname, function (exists) {
        if (exists) return callback(null);

        var current = path.resolve(dirname);

        ensure_directory(current, function (err) {
            if (err) return callback(err);
            
            fs.mkdir(current, 0766, function (err) {
                if (err) {
                    // maybe it got created while we were faffing about.. aargh.
                    fs.exists(current, function (exists) {
                        if (exists)
                            return callback();                            
                        else
                            return callback(err);
                    });
                }
                else {
                    callback();
                }
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

function forward_slash(str) {
    return str.replace(/\\/g, '/');
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

