
module.exports = function(config){
  if (typeof(config) !== typeof({})){
    config = {};
  }

  function LogLevelFromString(level){
    level = level.toLowerCase();
    for (var i=0; i < Logger.LEVEL.length; i++){
      if (Logger.LEVEL[i] === level){
	return i;
      }
    }
    return -1;
  };

  
  function GetDefault(level, defval){
    if (typeof(level) === 'string'){
      level = LogLevelFromString(level);
    }
    if (typeof(level) === 'number' && level >= 0 && level < Logger.LEVEL.length){
      return level;
    }
    return defval;
  };
  

  function Logger(namespace){
    var minLevel = GetDefault(config.minLevel, 0);
    var maxLevel = GetDefault(config.maxLevel, Logger.LEVEL.length-1);
    if (maxLevel < minLevel){
      maxLevel = minLevel;
    }
    
    var debug = require('debug')(namespace);

    Object.defineProperties(this, {
      "minLevel":{
	enumerable: true,
	get: function(){return minLevel;},
	set: function(l){
	  if (typeof(l) === 'string'){
	    l = LogLevelFromString(l);
	  }
	  if (typeof(l) === 'number' && l >= 0 && l < Logger.LEVEL.length){
	    minLevel = l;
	    if (minLevel > maxLevel){
	      maxLevel = minLevel;
	    }
	  } else {
	    throw new Error("Invalid value.");
	  }
	}
      },

      "maxLevel":{
	enumerable: true,
	get: function(){return maxLevel;},
	set: function(l){
	  if (typeof(l) === 'string'){
	    l = LogLevelFromString(l);
	  }
	  if (typeof(l) === 'number' && l >= 0 && l < Logger.LEVEL.length){
	    maxLevel = l;
	    if (maxLevel < minLevel){
	      minLevel = maxLevel;
	    }
	  } else {
	    throw new Error("Invalid value.");
	  }
	}
      },

      "formatters":{
	enumerable: false,
	get:function(){return debug.formatters;}
      }
    });

    this.log = function(){
      var args = Array.prototype.slice.call(arguments, 1);
      var level = arguments[0];
      if (typeof(level) === 'string'){
	level = LogLevelFromString(level);
      }
      if (typeof(level) === 'number' && level >= minLevel && level <= maxLevel){
	if (typeof(args[0]) === 'string'){
	  args[0] = "[" + Logger.LEVEL[level] + "] " + args[0];
	}
	debug.apply(debug, args);
      }
    };

    this.l = function(){
      this.log.apply(this, Array.prototype.slice.call(arguments));
    };

    this.debug = function(){
      if (0 >= minLevel && 0 <= maxLevel){
	var args = Array.prototype.slice.call(arguments);
	if (typeof(args[0]) === 'string'){
	  args[0] = "[debug] " + args[0];
	}
	debug.apply(debug, args);
      }
    };

    this.d = function(){
      this.debug.apply(this, Array.prototype.slice.call(arguments));
    };

    this.info = function(){
      if (1 >= minLevel && 1 <= maxLevel){
	var args = Array.prototype.slice.call(arguments);
	if (typeof(args[0]) === 'string'){
	  args[0] = "[info] " + args[0];
	}
	debug.apply(debug, args);
      }
    };

    this.i = function(){
      this.info.apply(this, Array.prototype.slice.call(arguments));
    };

    this.warning = function(){
      if (2 >= minLevel && 2 <= maxLevel){
	var args = Array.prototype.slice.call(arguments);
	if (typeof(args[0]) === 'string'){
	  args[0] = "[warning] " + args[0];
	}
	debug.apply(debug, args);
      }
    };
    
    this.w = function(){
      this.warning.apply(this, Array.prototype.slice.call(arguments));
    };

    this.error = function(){
      if (3 >= minLevel && 3 <= maxLevel){
	var args = Array.prototype.slice.call(arguments);
	if (typeof(args[0]) === 'string'){
	  args[0] = "[error] " + args[0];
	}
	debug.apply(debug, args);
      }
    };

    this.e = function(){
      this.error.apply(this, Array.prototype.slice.call(arguments));
    };
  }
  Logger.prototype.constructor = Logger;
  Logger.LEVEL = [
    "debug",
    "info",
    "warning",
    "error"
  ];

  return Logger;
};
