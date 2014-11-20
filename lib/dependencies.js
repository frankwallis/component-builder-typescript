var fs = require('fs');
var os = require('os');
var path = require('path');

function outputDependencies(root, manifest, cmpout, done) {
	var header = "/// ------------------------------------- ///" + os.EOL;
    header    += "/// Automatically generated. DO NOT EDIT. ///" + os.EOL;
    header    += "/// ------------------------------------- ///" + os.EOL + os.EOL;

   	var content = flatten(root)
        .filter(function(branch) {
            if ((branch.name.split('/')[1] == root.name) && (branch.type == 'dependency'))
                throw new Error("circular dependency detected");

            return is_typecript_dependency(branch);
        })
        .reduce(function(current, branch) {
            var dtsfile = path.join(branch.path, get_declaration_file(branch.node)); 

            current += '/// <reference path="';
            current += forward_slash( path.relative(path.dirname(root.node.main), dtsfile) );
            current += '" />' + os.EOL;
    
            return current;
        }, header);

    // create a _dependencies.d.ts file in the same location as
    // the main file for this component    
    var filename = path.join(path.dirname(root.node.main), "_dependencies.d.ts");
    fs.writeFile(filename, content, function() {
    	cmpout.log('typescript', 'generated ' + forward_slash(path.join(root.name, filename)));	
    	done();
    });
}

function flatten(branch) {
	var ordered = [];
	var resolved = [];

	function traverse(branch) {
    	if (~resolved.indexOf(branch)) 
            return;
    	resolved.push(branch);
    
    	traverseDeps(branch);
    	ordered.push(branch);
  	}

  	function traverseDeps(branch) {
    	var deps = branch.dependencies;
    	if (!deps) 
            return;
    	var names = Object.keys(deps);
    	for (var i = 0; i < names.length; i++)
      		traverse(deps[names[i]]);
  	}
  
  	traverse(branch);
  	return ordered.reverse();
}

function forward_slash(str) {
    return str.replace(/\\/g, '/');
}

function is_typecript_dependency(branch) {
    return (get_declaration_file(branch.node) && (branch.type != 'local'))
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

module.exports = outputDependencies; 