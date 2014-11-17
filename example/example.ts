/// <reference path="./_references.d.ts" />
require("angular");

export var Module: ng.IModule = angular.module("example", [ 
    
]);

Module.service("exampleService", require('./example-service'));
