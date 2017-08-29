
module.exports = function(config){
  if (typeof(config) !== typeof({})){
    config = {};
  }
  var logDomain = (typeof(config.logDomain) === 'string') ? config.logDomain : "";

  function Logger(namespace, options){
    if (typeof(options) !== typeof({})){
      options = (typeof(config.logging) !== 'undefined') ? config.logging : {};
    }
    var debug = require('debug')(((logDomain === "") ? "" : logDomain + ":") + namespace);

    var info_enabled = (options.info_enabled === true);
    var error_enabled = (options.error_enabled === true);
    var warning_enabled = (options.warning_enabled === true);
    var debug_enabled = (options.debug_enabled === true);
    if (typeof(options.all) === 'boolean'){
      info_enabled = options.all;
      error_enabled = options.all;
      warning_enabled = options.all;
      debug_enabled = options.all;
    }

    var self = this;
    Object.defineProperties(this, {
      "info_enabled":{
	enumerable: true,
	get:function(){return info_enabled;},
	set:function(e){
	  info_enabled = (e === true);
	}
      },

      "warning_enabled":{
	enumerable: true,
	get:function(){return warning_enabled;},
	set:function(e){
	  warning_enabled = (e === true);
	}
      },

      "error_enabled":{
	enumerable: true,
	get:function(){return error_enabled;},
	set:function(e){
	  error_enabled = (e === true);
	}
      },

      "debug_enabled":{
	enumerable: true,
	get:function(){return debug_enabled;},
	set:function(e){
	  debug_enabled = (e === true);
	}
      },

      "info":{
	enumerable: true,
	value: function(){
	  if (info_enabled === true){
	    var args = Array.prototype.slice.call(arguments);
	    if (typeof(args[0]) === 'string'){
	      args[0] = "[INFO] " + args[0];
	    }
	    debug.apply(debug, args);
	  }
	}
      },
      "i":{
	enumerable: true,
	value:function(){
	  self.info.apply(self, arguments);
	}
      },

      "warning":{
	enumerable: true,
	value: function(){
	  if (warning_enabled === true){
	    var args = Array.prototype.slice.call(arguments);
	    if (typeof(args[0]) === 'string'){
	      args[0] = "[INFO] " + args[0];
	    }
	    debug.apply(debug, args);
	  }
	}
      },
      "w":{
	enumerable: true,
	value:function(){
	  self.warning.apply(self, arguments);
	}
      },

      "error":{
	enumerable: true,
	value: function(){
	  if (error_enabled === true){
	    var args = Array.prototype.slice.call(arguments);
	    if (typeof(args[0]) === 'string'){
	      args[0] = "[ERROR] " + args[0];
	    }
	    debug.apply(debug, args);
	  }
	}
      },
      "e":{
	enumerable: true,
	value:function(){
	  self.error.apply(self, arguments);
	}
      },

      "debug":{
	enumerable: true,
	value: function(){
	  if (debug_enabled === true){
	    var args = Array.prototype.slice.call(arguments);
	    if (typeof(args[0]) === 'string'){
	      args[0] = "[DEBUG] " + args[0];
	    }
	    debug.apply(debug, args);
	  }
	}
      },
      "d":{
	enumerable: true,
	value:function(){
	  self.debug.apply(self, arguments);
	}
      }
    });
    
  }
  Logger.prototype.constructor = Logger;

  return Logger;
};
