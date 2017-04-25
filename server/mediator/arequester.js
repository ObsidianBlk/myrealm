
/**
 * Asyncronous Request (function) Caller
 * @module server/mediator/arequester
 * @author Bryan Miller <bmiller1008@gmail.com>
 * @copyright Bryan Miller 2017
 */
module.exports = (function(){
  Promise = require('bluebird');


  function GenerateNamespaceList(namespace){
    var nsl = namespace.split(".");
    for (var i=0; i < nsl.length; i++){
      nsl[i].trim();
      if (nsl[i] === ""){
	return null;
      }
    }
    return nsl;
  }


  
  /**
   * Creates an asyncronous request caller object.
   * @constructor
   */
  function arequester(){
    var FUNCS = []; // Stores the actual function information.
    var NSTREE = {}; // Namespace tree where each leaf is an index into the FUNCS list.


    function Flatten(obj, base){
      if (typeof(base) !== 'string'){
	base = "";
      }
      var lst = [];
      var otype = typeof({});
      var keys = Object.keys(obj);
      for (var k=0; k < keys.length; k++){
	if (obj.hasOwnProperty(keys[k]) && typeof(obj[keys[k]]) === otype){
	  lst.push(base + "." + keys[k]);
	  lst.concat(Flatten(obj[keys[k]], lst[lst.length-1]));
	}
      }
      return lst;
    };


    Object.defineProperties(this, {
      "count":{
	enumerable:true,
	get:function(){return FUNCS.length;}
      },

      "requestList":{
	get:function(){
	  return Flatten(NSTREE);
	}
      }
    });


    function NSToFuncIndex(namespace){
      var nsl = GenerateNamespaceList(namespace);
      if (nsl === null){
	throw Error("Invalid namespace given.");
      }

      var otype = typeof({});
      var ns = NSTREE;
      for (var i=0; i < nsl.length; i++){
	var key = nsl[i];
	// We've hit a leaf in the previous step or the key doesn't exist in the current ns object.
	if (typeof(ns) !== otype || !(key in ns)){
	  ns = {}; // Dummy object.
	  break;
	}
	ns = ns[key];
      }

      return (typeof(ns) === 'number') ? ns : -1;
    };
    
    /**
     * Define a request function for the given namespace.
     * NOTE: Method will fail if namespace already used.
     *
     * @method define
     * @param {string} namespace - The namespace of the function.
     * @param {function} func - The function stored at the given namespace.
     * @param {*} [owner=null] - The owner for which the function will be bound when called.
     */
    this.define = function(namespace, func, owner){
      if (typeof(func) !== 'function'){
	throw new TypeError("Expected a function.");
      }
      var nsl = GenerateNamespaceList(namespace);
      if (nsl === null){
	throw new Error("Given namespace is invalid.");
      }
      if (typeof(owner) === 'undefined'){
	owner = null;
      }

      var ns = NSTREE;
      var li = nsl.length-1;
      for (var i=0; i < nsl.length; i++){
	var key = nsl[i];
	if (key in ns){
	  // If we're at the end of the given namespace or there's a leaf at the current namespace position, we've got an issue here.
	  if (i === li || typeof(ns[key]) === 'number'){
	    throw new Error("Namespace cannot be or is already defined.");
	  }
	  // Otherwise... move along.
	  ns = ns[key];
	} else {
	  // For undefined keys, if we're at the end of the namespace, set the leaf index value, otherwise, create a new empty object.
	  ns[key] = (i === li) ? FUNCS.length : {};
	  ns = ns[key]; // Even if this is a number, this should effect us (numbers only set at end of namespace anyway).
	}
      }

      // If we got this far, then we're ready to actually store the function!
      FUNCS.push({
	func:func,
	owner:owner
      });
    };

    /**
     * Returns true if the given namespace has been defined and false otherwise.
     * NOTE: Partial namespaces are allowed.
     *
     * @method defined
     * @param {string} namespace - The namespace to search for.
     * @returns {boolean}
     */
    this.defined = function(namespace){
      var nsl = GenerateNamespaceList(namespace);
      var ns = null;
      var li = nsl.length - 1;
      if (nsl !== null){
	ns = NSTREE;
	for (var i=0; i < nsl.length; i++){
	  var key = nsl[i];
	  // If the current key doesn't exist, or we're not at the end of the namespace and we hit a leaf... quit!
	  if (!(key in ns) || (i !== li && typeof(ns[key]) === 'number')){
	    ns = null;
	    break; // quit.
	  } else {
	    ns = ns[key]; // Move along.
	  }
	}
      }
      return (ns !== null);
    };

    /**
     * Returns a promise which calls the function defined at the given namespace. Undefined or non-function namespaces will
     * return promises, but with no value.
     *
     * @method request
     * @param {string} namespace - The namespace of the function to call.
     * @param {...*} * - Any number of additional arguments to be passed to called function.
     * @returns {Promise}
     */
    this.request = function(){
      if (arguments.length > 0){
	// Undocumented feature... "namespace" can be an index value into hidden FUNCS list :-p
	var index = (typeof(arguments[0]) === 'number') ? arguments[0] : NSToFuncIndex(arguments[0]);
	if (index >= 0 && index < FUNCS.length){
	  var fn = FUNCS[index].func;
	  var owner = FUNCS[index].owner;
	  var args = (arguments.length > 1) ? Array.prototype.slice.call(arguments, 1) : null;
	  return new Promise(function(resolve, reject){
	    resolve(fn.apply(owner, args));
	  });
	}
      }
      // Namespace not given or did not lead to a function call. Return empty promise.
      return Promise.resolve();
    };
    /**
     * Shorthand for the request() method.
     *
     * @method r
     * @param {string} namespace - The namespace of the function to call.
     * @param {...*} * - Any number of additional arguments to be passed to called function.
     * @returns {Promise}
     */
    this.r = this.request;
  }
  arequester.prototype.constructor = arequester;

  return arequester;
})();
