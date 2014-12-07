var path = require('path');
var os = require('os');
var dts = require('./dts-bundle');
var Compiler = require('./compiler');

/*
 * If your component.json has a "typescript.definition" entry we create an 
 * external definition file for your component and place it there.
 */
function outputDeclarationFileSync(branch, manifest, outputCache, options, cmpout) {
    var outputFile = get_declaration_file(branch.node);

    if (!outputFile) {
        outputFile = "api/" + branch.node.name + ".d.ts";
    }

    outputFile = path.join(branch.path, outputFile);

    // reference all the loose declaration files in the component
    var header  = "/// ------------------------------------- ///" + os.EOL;
        header += "/// Automatically generated. DO NOT EDIT. ///" + os.EOL;
        header += "/// ------------------------------------- ///" + os.EOL + os.EOL;

    var scripts = options.fields.
        reduce(function(scripts, fieldname) {
            if (manifest.field[fieldname])
                return scripts.concat(manifest.field[fieldname]);
            else
                return scripts;
        }, [])

    var header = scripts
      .filter(function(script) {            
        if (script.filename == outputFile)
            return false;
        
        return Compiler.isTypescriptDeclaration(script.path);
      })
      .reduce(function(current, script) {

        var dtsfile = path.join(branch.path, script.path);
        var basename = path.basename(script.path);

        if ((basename != '_references.d.ts') && (basename != '_dependencies.d.ts')) {
            current += '/// <reference path="';
            current += Compiler.normalizePath(path.relative(path.dirname(outputFile), dtsfile));
            current += '" />' + os.EOL;
        }

        return current;
      }, header) + os.EOL;

    // use dts-bundle to generate the external definitions
    var main = path.join(branch.path, change_extension(branch.node.main, "d.ts"));

    dts.bundle({
        inputFiles: outputCache,
        headerText: header,
        name: branch.node.name,
        main: main,
        out: outputFile,
        baseDir: branch.path
    });
    
    cmpout.log('typescript', 'generated ' + Compiler.normalizePath(path.join(branch.node.name, path.relative(branch.path, outputFile))));
    return true;
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

function change_extension(file, ext) {
    return path.join(path.dirname(file), path.basename(file, path.extname(file)) + '.' + ext);
}

module.exports = outputDeclarationFileSync;