component-builder-typescript
============================

typescript plugin for component

# Overview #

one of the best things about component is having access to every file required to
build your application. the other best thing about component is having access to the
dependency tree. 

component-builder-typescript uses this information to minimise the number of files read
and compiled which produces a highly optimised build.

when used in a watch task component-builder-typescript performs incremental builds, 
only compiling components which have changed and their dependents.

component-builder-typescript  will generate an external definition file for your component
(using dts-bundle) which can be used by your IDE or distributed with JavaScript.

component-builder-typescript uses version 1.3 of the typescript compiler

# API #

componentBuilderTypescript(options);

options:

Name         			| Description												| Default
------------------------|-----------------------------------------------------------|-----------
generateDeclarations	| generate an external declaration file for the component 	| true
generateSourceMaps		| generate inline source maps in the generated code 		| true
gulpMode				| use gulp-style logging									| false
noImplicitAny			| typescript compiler option 								| false
removeComments			| typescrpt compiler option							 		| false
target					| typescrpt compiler option									| es5

# component.json #

## fields ##
when building component-builder-typescript will import declaration files from both 
the 'scripts' and 'files' fields of your component.json. If you are using the 'files'
field (for exporting definitions from a javascript project perhaps) then you need to 
remember to include the 'files' field in your build.

## exported declarations ##
declaration files are generated for local components and components which have been linked using
`component link`

you can specify the location of the generated external definition file like this:

```
{
    "name" : "component-builder-typescript-example",
    "typescript" : {
        "definition": "exports/component-builder-typescript-example.d.ts"
    },
    "dependencies" : {
        "component/jsdomify": "1.3"
    },
    "main" : "example/example.ts",
    "scripts" : [
        "example/_dependencies.d.ts",
        "example/example.ts",
        "example/example-types.d.ts"  
    ]
}
```

# Credits #

Greg Smith [Tsify](https://github.com/smrq/tsify)

