var dts = require('dts-bundle');
var cmpout = require('component-consoler');
var path = require('path');
var fs = require('fs');
var os = require('os');

/*
 * If your component.json has a "typescript" file we create an 
 * external definition file for your component and place it there.
 */
function outputDefinitionFile(branch, outputCache, looseDefFiles) {
    var outputFile = get_definition(branch.node);

    if (outputFile) {
        // write all the generated definition files to /tmp
        Object.keys(outputCache).forEach(function(filename) {
            if (ends_with(filename, ".d.ts")) {
                var tmppath = path.join(branch.path, filename);
                ensure_directory(tmppath);
                fs.writeFileSync(tmppath, outputCache[filename]);
            }
        });

        // use dts-bundle to build the external definition file
        var main = path.join(branch.path, 'tmp', path.basename(change_extension(branch.node.main, ".d.ts")));
        dts.bundle({
            name: branch.node.name,
            main: main,
            out: outputFile,
            baseDir: branch.path
        });

        // and append any loos definitions in the project
        var loosedefs = looseDefFiles.reduce( function(current, filename) {
            filename = path.join(branch.path, filename);
            var source = fs.readFileSync(filename, { 'encoding': 'utf8' });

            //if (starts_with(path.dirname(filename), path.dirname(branch.node.main))) {
              //  if ( ends_with(filename,  ".d.ts")) {
                    var defstext = strip_triple_comments(source);

                    if (defstext.length > 0)
                        current += defstext + os.EOL; 
                //}
            //}

            return current;
        }, "");

        outputFile = path.join(branch.path, outputFile);

        if (loosedefs.length > 0)
            fs.appendFileSync(outputFile, loosedefs);

        cmpout.log('typescript', 'generated ' + outputFile);
    }
    else {
        cmpout.warn('typescript', 'no definition file generated');   
    }
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

