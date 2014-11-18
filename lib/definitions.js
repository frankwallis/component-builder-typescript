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
function outputDefinitionFile(branch, outputCache, looseDefFiles) {
    var outputFile = get_definition(branch.node);

    if (!outputFile) {
        cmpout.warn('typescript', 'no definition file generated');   
        return;
    }

    writeOutputFiles(branch, outputCache, function() {
        // use dts-bundle to build the external definition file
        var main = path.join(branch.path, 'tmp', path.basename(change_extension(branch.node.main, ".d.ts")));

        dts.bundle({
            name: branch.node.name,
            main: main,
            out: path.join(branch.path, outputFile),
            baseDir: path.dirname(main) // keep this path as 'high' as possible - dts-bundle uses an expensive glob
        });

        readLooseFiles(branch, looseDefFiles, function(err, loosedefs) {
            var loosedef = loosedefs.reduce(function(current, def) {
                var defstext = strip_triple_comments(def);

                if (defstext.length > 0)
                    current += defstext + os.EOL; 

                return current;                
            }, "");

            outputFile = path.join(branch.path, outputFile);

            if (loosedef.length > 0)
                fs.appendFileSync(outputFile, loosedef);

            cmpout.log('typescript', 'generated ' + path.join(branch.name, path.relative(branch.path, outputFile)));
        });

        // and append any loose definitions in the project
        // var loosedefs = looseDefFiles.reduce( function(current, filename) {
        //     filename = path.join(branch.path, filename);
        //     var source = fs.readFileSync(filename, { 'encoding': 'utf8' });

        //     var defstext = strip_triple_comments(source);

        //     if (defstext.length > 0)
        //         current += defstext + os.EOL; 

        //     return current;
        // }, "");

        // outputFile = path.join(branch.path, outputFile);

        // if (loosedefs.length > 0)
        //     fs.appendFileSync(outputFile, loosedefs);

        
    })
}

function writeOutputFiles(branch, outputCache, cb) {
    function writeFile(filename, cb) {
        var tmppath = path.join(branch.path, filename);
        ensure_directory(tmppath);
        fs.writeFile(tmppath, outputCache[filename], cb);
    }

    var filelist = Object.keys(outputCache).filter(function(filename) {
        return ends_with(filename, ".d.ts");
    });

    async.map(filelist, writeFile, cb);
}

function readLooseFiles(branch, filelist, cb) {

    function readFile(filename, done) {
        filename = path.join(branch.path, filename);
        fs.readFile(filename, { "encoding": "utf8" }, done);
    }

    async.map(filelist, readFile, cb);
}

function ensure_directory(filename) {
    var dirname = path.dirname(filename);

    if( !fs.existsSync(dirname)) {
        ensure_directory(dirname);
        fs.mkdirSync(dirname, 0766)
    }
}

function change_extension(file, ext) {
    return path.join(path.dirname(file), path.basename(file, path.extname(file)) + ext);
}

function starts_with(str, pref) {
    return (str.indexOf(pref) === 0);
}

function ends_with(str, post) {
    return str.lastIndexOf(post) + post.length === str.length;
}

function get_definition(node) {
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

module.exports = outputDefinitionFile;

