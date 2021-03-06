/**
 * Asyncronous Emitter Module
 * @module server/mediator/aemitter
 * @author Bryan Miller <bmiller1008@gmail.com>
 * @copyright Bryan Miller 2017
 */
module.exports = (function(){
  Promise = require('bluebird');


  /**
   * Creates an asyncronous emitter object.
   * @constructor
   */
  function aemitter(){
    var EVENTS = {};
    var FUNCS = {};

    /**
     * Adds a listener function callback to the event given by name.
     *
     * @method on
     * @param {string} name - The name of the event to listen for.
     * @param {function} func - The function to call when the event is triggered.
     * @param {*} [owner=null] - The "owner" of "func". Will be used as "this" when calling "func".
     * @param {boolean} [once=false] - If true, given function will only be called on the next emit of this event, then removed.
     */
    this.on = function(name, func, owner, once){
      if (typeof(func) !== 'function'){
	throw new TypeError("Expected function.");
      }
      if (typeof(owner) === 'undefined'){
	owner = null;
      }
      once = (once === true);

      if (!(name in EVENTS)){
	EVENTS[name] = [];
      }
      for (var e=0; e < EVENTS[name].length; e++){
	if (EVENTS[name][e].func === func && EVENTS[name][e].owner === owner){
	  EVENTS[name][e].once = once;
	  return; // Event listener already defined. Only thing needed was a possible 'once' state change.
	}
      }
      EVENTS[name].push({
	func: func,
	owner: owner,
	once: once
      });
    };

    /**
     * Adds a listener function callback to the event given by name set to only be called on the next emit of this event then removed.
     *
     * @method once
     * @param {string} name - The name of the event to listen for.
     * @param {function} func - The function to call when the event is triggered.
     * @param {*} [owner=null] - The "owner" of "func". Will be used as "this" when calling "func".
     * @see on
     */
    this.once = function(name, func, owner){
      this.on(name, func, owner, true);
    };

    /**
     * Removes the given listener function callback from the event given by name.
     *
     * @method removed
     * @param {string} name - The name of the event to remove from.
     * @param {function} func - The function to remove.
     * @param {*} [owner=null] - The "owner" of "func" being removed.
     * @see on
     */
    this.remove = function(name, func, owner){
      if (name in EVENTS){
	owner = (typeof(owner) === 'undefined') ? null : owner;
	for (var e=0; e < EVENTS[name].length; e++){
	  if (EVENTS[name][e].func === func && EVENTS[name][e].owner === owner){
	    EVENTS[name].splice(e, 1);
	    break;
	  }
	}
      }
    };

    /**
     * Clears all event listeners for the given event name.
     *
     * @method clear
     * @param {string} name - The name of the event to clear.
     */
    this.clear = function(name){
      if (name in EVENTS){
	delete EVENTS[name];
      }
    };

    /**
     * Removes all event listeners.
     *
     * @method clearAll
     */
    this.clearAll = function(){
      EVENTS = {};
    };

    /**
     * Returns a Promise which calls all listeners attached to the given event name.
     * Any number of optional arguments included after the event name.
     *
     * @method emit
     * @param {string} name - The name of the event.
     * @param {...*} * - Any number of additional arguments to be passed to the listeners.
     * @returns {Promise} - Returned promise will complete when all event callbacks have completed.
     */
    this.emit = function(){
      if (arguments.length >= 1){
	var name = arguments[0];
	if (name in EVENTS){
	  var args = (arguments.length > 1) ? Array.prototype.slice.call(arguments, 1) : null;
	  var promlist = [];
	  // NOTE: I'm cheating the use of "filter" here. I'm wrapping each event function in a promise and storing that in the
	  // promlist variable, THEN checking the filter condition... A "two birds with one stone" sort of thing. Enjoy!
	  EVENTS[name] = EVENTS[name].filter(function(e){
	    promlist.push(new Promise(function(resolve, reject){
	      try{
		e.func.apply(e.owner, args);
	      } catch (e) {
		reject(e);
	      }
	      resolve();
	    }));
	    return (e.once === false);
	  });

	  // Ok... now we have out list of promises... let's return a promise waiting for all others to complete :)
	  return Promise.all(promlist); // This allows the user to wait for all events to complete if they choose.
	}
      }
      return Promise.resolve();
    };
    /**
     * Shorthand for the emit() method.
     *
     * @method e
     * @param {string} name - The name of the event.
     * @param {...*} * - Any number of additional arguments to be passed to the listeners.
     * @returns {Promise}
     */
    this.e = this.emit;
  }
  aemitter.prototype.constructor = aemitter;

  return aemitter;
})();
