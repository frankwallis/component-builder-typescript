/// <reference path="./_references.d.ts" />
//declare module example {
//	interface IExampleGreeter {
//		greet(name: string);
//	}
//}
var Greeter = (function () {
    function Greeter(message) {
        this.greeting = message;
    }
    Greeter.prototype.greet = function (name) {
        return this.greeting + " " + name;
    };
    return Greeter;
})();

module.exports = Greeter;
//# sourceMappingURL=example-service.js.map
