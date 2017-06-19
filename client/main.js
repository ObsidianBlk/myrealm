require("aframe");
window.REALM = (function(){
  var host = window.document.location.host.replace(/:.*/, '');
  var port = (window.document.location.port !== "") ? parseInt(window.document.location.port) : null;
  var config = require('./config');
  var Emitter = require('./emitter');
  var emitter = new Emitter();

  var readyBuff = null;

  var obj = {};
  obj.ready = function(fn){
    if (typeof(fn) !== 'function'){
      throw new TypeError("Expected a function.");
    }
    
    if (document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) {
      fn.call(fn);
    } else {
      if (readyBuff === null){
	readyBuff = [];
	document.addEventListener("DOMContentLoaded", function(){
	  for (var i=0; i < readyBuff.length; i++){
	    readyBuff[i].call(readyBuff[i]);
	  }
	  readyBuff = null;
	});
      } else {
	readyBuff.push(fn);
      }
    }
  };

  
  Object.defineProperties(obj, {
    "Server":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: require('./server')(emitter, host, {
	port: port,
	ssl: document.location.protocol === "https:",
	reconnectDuration: ((config.reconnectDuration) ? config.reconnectDuration : 5),
	revalidateDuration: ((config.revalidateDuration) ? config.revalidateDuration : 720)
      })
    },

    "Emitter":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: emitter
    },

    "AFRAME":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: window.AFRAME
    },

    "THREE":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: window.THREE
    }
  });

  // Global error handler...
  window.addEventListener('error', function (e) {
    var stack = e.error.stack;
    var message = e.error.toString();
    if (stack) {
      message += '\n' + stack;
    }
    console.log(message);
  });

  return obj;
})();

require('./modules/look-controls-alt');
require('./modules/touch-move-controls');
require('./modules/visitor');
