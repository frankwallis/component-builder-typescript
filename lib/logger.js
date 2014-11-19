module.exports = function(options) {

	if (options.gulp) {
		var gutil = require('gulp-util');
	
		return {
			log: function(arg1, arg2) {
				gutil.log(gutil.colors.green(arg1), arg2);
			},
			error: function(arg1, arg2) {
				gutil.log(gutil.colors.red(arg1), arg2);
			}
		}
	}
	else
		return require('component-consoler');
}