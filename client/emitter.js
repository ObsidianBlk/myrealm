
module.exports = (function(){
  function Emitter(){
    var EVENT = {};
    this.on = function(name, fn, owner, once){
      if (typeof(fn) !== 'function'){
	throw new TypeError("Expected a function.");
      }
      if (typeof(owner) === 'undefined'){
	owner = null;
      }
      once = (once === true);
      
      if (!(name in EVENT)){
	EVENT[name] = [];
      } else {
	// Check to see if the functions and owner are already assigned to this event.
	for (var i=0; i < EVENT[name].length; i++){
	  if (EVENT[name][i].fn === fn && EVENT[name][i].owner === owner){
	    EVENT[name][i].once = once; // (Possibly) Swap the once state. Otherwise...
	    return; // Already listening. Done.
	  }
	}
      }
      
      EVENT[name].push({fn:fn, owner:owner, once:once});
    };

    this.once = function(name, fn, owner){
      this.on(name, fn, owner, true);
    };

    this.unlisten = function(name, fn, owner){
      if (name in EVENT){
	if (typeof(owner) === 'undefined'){
	  owner = null;
	}
	for (var i=0; i < EVENT[name].length; i++){
	  if (EVENT[name][i].fn === fn && EVENT[name][i].owner === owner){
	    EVENT[name].splice(i, 1);
	    break;
	  }
	}
      }
    };

    this.unlistenAll = function(name){
      if (name in EVENT){
	delete EVENT[name];
      }
    };

    this.emit = function(){
      var name = (arguments.length > 0 && typeof(arguments[0]) === 'string') ? arguments[0] : "";
      if (name in EVENT){
	var args = Array.prototype.slice.call(arguments, 1);
	for (var i=0; i < EVENT[name].length; i++){
	  EVENT[name][i].fn.apply(EVENT[name][i].owner, args);
	  if (EVENT[name].once === true){
	    EVENT[name].splice(i, 1);
	    i--;
	  }
	}
      }
    };
  }
  Emitter.prototype.constructor = Emitter;
  
  return Emitter;
})();
