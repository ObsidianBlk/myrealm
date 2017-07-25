
module.exports = (function(){
  var Promise = require('bluebird');

  function Middleware(){
    var stack = function(ctx, next){
      next();
    };
    
    this.use = function(fn){
      var self = this;
      stack = (function(_stack){
        return function(ctx, next){
          fn.call(null, ctx, function(){
            _stack.call(null, ctx, next);
          });
        };
      })(stack);
    };

    this.exec = function(ctx){
      return new Promise(function(resolve, reject){
        try {
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

  /*
  function compose(fnl){
    return function(context, next){
      var index = -1; // Last called function in the list.
      function process(i){
        if (i <= index){
          return Promise.reject(new Error("next() called multiple times."));
        }
        index = i;
        if (i === fnl.length){
          return Promise.resolve();
        }
        
        return new Promise(function(resolve, reject){
          console.log("Hello there " + index);
          fnl[i](context, function(){
            resolve(process(i+1));
          });
          console.log("test " + index);
        });
      }
      return process(0);
    };
  };

  function Middleware(){
    var middleware = [];

    this.use = function(fn){
      if (typeof(fn) !== 'function'){
        throw new TypeError("Middleware function expected.");
      }
      middleware.push(fn);
      return this;
    };

    this.exec = function(ctx){
      var fn = compose(middleware);
      return fn(ctx);
    };
  }
  Middleware.prototype.constructor = Middleware;
  return Middleware;
  */
  
})();
