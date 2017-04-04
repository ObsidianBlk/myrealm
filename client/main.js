require("aframe");
window.REALM = (function(){
  var host = window.document.location.host.replace(/:.*/, '');
  var Emitter = require('./emitter');
  var emitter = new Emitter();

  var obj = {};
  Object.defineProperties(obj, {
    "Server":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: require('./server')(emitter, host, {
	port: 3000,
	ssl: document.location.protocol === "https:"
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

  return obj;
})();

