
module.exports = (function(){
  var Promise = require('bluebird');

  function Middleware(){
    var mfn = [];

    function build_stack(){
      var stack = function(ctx, next){
	next();
      };

      // Making sure we're in FIFO order.
      mfn.slice().reverse().forEach(function(fn){
	stack = (function(_stack){
	  return function(ctx, next){
	    fn.call(null, ctx, function(){
	      _stack.call(null, ctx, next);
	    });
	  };
	})(stack);
      });

      return stack;
    }

    this.use = function(fn){
      if (fn instanceof Array){
	for (var i=0; i < fn.length; i++){
	  this.use(fn[i]);
	}
      } else if (typeof(fn) === 'function'){
	mfn.push(fn);
      } else {
	throw new TypeError("Expected a function or an Array of functions.");
      }
      return this;
    };

    this.exec = function(ctx){
      return new Promise(function(resolve, reject){
        try {
	  var stack = build_stack();
          stack(ctx, function(){
            resolve(ctx);
          });
        } catch (e) {
          reject(e);
        }
      });
    };
  }
  Middleware.prototype.constructor = Middleware;
  return Middleware;
  
})();
