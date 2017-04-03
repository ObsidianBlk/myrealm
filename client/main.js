require("aframe");
window.REALM = (function(){
  var host = window.document.location.host.replace(/:.*/, '');

  var obj = {};
  Object.defineProperties(obj, {
    "messenger":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: require("./messenger")(host, 3000, 5)
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

