var fs = require('fs');
var os = require('os');
var path = require('path');

function outputDependencies(root, branch, manifest, cmpout, done) {
	var header = "/// ------------------------------------- ///" + os.EOL;
    header    += "/// Automatically generated. DO NOT EDIT. ///" + os.EOL;
    header    += "/// ------------------------------------- ///" + os.EOL + os.EOL;

    var branchMainDir = path.dirname(path.join(branch.path, branch.node.main));

   	var content = flatten(branch)
        .filter(function(dep) {
            if (dep == branch)
                return false;

            if ((dep.name.split('/')[1] == branch.name) && (dep.type == 'dependency'))
                throw new Error("circular dependency detected");

            return is_typecript_dependency(dep);
        })
        .reduce(function(current, dep) {
            var dtsfile = path.join(dep.path, get_declaration_file(dep.node)); 

            current += '/// <reference path="';
            current += forward_slash( path.relative(branchMainDir, dtsfile) );
            current += '" />' + os.EOL;
    
            return current;
        }, header);

    // create a _dependencies.d.ts file in the same location as
    // the main file for this component    
    var filename = path.join(branchMainDir, "_dependencies.d.ts");

    fs.writeFile(filename, content, function() {
    	cmpout.log('typescript', 'generated ' + forward_slash(path.join(branch.name, path.relative(branch.path, filename))));	
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