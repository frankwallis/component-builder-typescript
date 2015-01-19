component-builder-typescript
============================

typescript compiler plugin for component

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

component-builder-typescript uses version 1.4 of the typescript compiler

# API #

componentBuilderTypescript(options);

options:

Name       		   | Description											| Default
-------------------|--------------------------------------------------------|-----------
fields             | fields to use                                          | ['scripts'] 
declareRequire     | include a commonjs require declaration                 | true
declaration	       | generate an external declaration file                  | true
sourceMap		   | generate source maps for component-builder             | false
inlineSourceMap    | generate inline source maps in the generated code      | false
gulpMode           | use gulp-style logging									| false
ignoreRemoteFilesRx| ignore remote source files matching this regex         | 
strict             | when false all declaration files will be incuded       | true
noImplicitAny      | typescript compiler option 							| false
removeComments	   | typescrpt compiler option							 	| false

# component.json #

## fields ##
by default component-builder-typescript will use typescript files found in 
the 'scripts' field of your component.json, but you can override this using the 'fields' property of the configuration options.

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
        "exports/component-builder-typescript-example.d.ts",
        "example/_dependencies.d.ts",
        "example/example.ts",
        "example/example-types.d.ts"  
    ]
}
```

# Credits #

Greg Smith [Tsify](https://github.com/smrq/tsify)
Bart van der Schoor [dts-bundle](https://github.com/TypeStrong/dts-bundle)

