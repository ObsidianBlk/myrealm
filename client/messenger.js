
module.exports = function(host, options){
  var Messenger = {};

  Object.defineProperties(Messenger, {
    "connection":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: require('./connection')(host, options)
    }
  });
  
  return Messenger;
};
