
module.exports = (function(){
  var Promise = require('bluebird');

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
        
        try {
          return new Promise(function(resolve, reject){
            fnl[i](context, function(){
              resolve(process(i+1));
            });
          });
          /*
          return Promise.resolve(fnl[i](context, function(){
            return process(i+1);
          }));
          */
        } catch (e) {
          return Promise.reject(e);
        }
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
  
})();
