
// TODO: Remember hellojs as a possible social auth middleware.

/**
 * Socket Client Hub
 * @module server/mediator/sockets
 * @author Bryan Miller <bmiller1008@gmail.com>
 * @copyright Bryan Miller 2017
 */
module.exports = function(workerid, emitter, r, config){
  var Promise = require('bluebird');
  var Middleware = require('../middleware/middleware');
  var CreateContext = require('./context');
  var Logger = require('../utils/logger')(config.logging);
  var logSocket = new Logger(config.logDomain + ":sockets");

  // This will hold the socket server that this whole module runs on!
  var sserver = null;

  var CLIENT = {};
  var MESSAGE = {};
  var OpenMessageHandler = null;

  var clientBufferTransmitRate = (1/60)*1000;

  var broadcastKey = r.Key("__INTERNAL_@0_", "BROADCAST");
  r.sub.on(broadcastKey, function(channel, message){
    var broadcast = JSON.parse(message);
    ProcessBroadcast(broadcast.message, broadcast.sender, broadcast.receiver);
  });
  r.sub.subscribe(broadcastKey);
  

  function ProcessException(e, client){
    logSocket.error("[WORKER %d] %s", workerid, e.message);
    if (typeof(client) !== 'undefined'){
      client.send(JSON.stringify({
	status: "F",
	error: e.message
      }));
    }
  }

  function ProcessClientBuffers(id){
    var co = CLIENT[id];
    var buff = null;

    switch(co.buffer.length){
    case 0: // Nothing to send...
      break;
    case 1: // Send the 0th entry directly.
      buff = co.buffer;
      co.buffer = [];
      logSocket.debug("[WORKER %d] Sending command to client '%s'.", workerid, co.id);
      co.client.send(JSON.stringify(buff[0]));
      break;
    default: // Send all msgs in a special command.
      buff = co.buffer;
      co.buffer = [];
      logSocket.debug("[WORKER %d] Sending buffered commands to client '%s'.", workerid, co.id);
      co.client.send(JSON.stringify({
	cmds:buff
      }));
    }

    // Wait for the next timeout to process.
    co.processID = setTimeout(function(){
      ProcessClientBuffers(id);
    }, clientBufferTransmitRate);
  }

  function ProcessClientMessage(co, msg){
    logSocket.debug("[WORKER %d] Processing message for '%s'.", workerid, (co.id !== null) ? co.id : "UNVALIDATED");
    if (typeof(msg) === 'string'){
      try {
	msg = JSON.parse(msg);
      } catch (e) {
	logSocket.warning("[WORKER %d] Client request not a valid JSON object.", workerid);
	return;
      }
    }
    
    if ("type" in msg){
      var rname = msg["type"];
      if (rname in MESSAGE){
	var ctx = CreateContext(co, msg, {
	  broadcast: Sockets.broadcast,
	  send: Sockets.send,
	  register: (co.id === null) ? function(){
	    if (co.id !== null){
	      logSocket.debug("[WORKER %d] Officially registered client '%s'.", workerid, co.id);
	      CLIENT[co.id] = co;
	      // Tell any plugins that a client with the given id has "connected"
	      emitter.emit("client_connected", co.id);
	    }
	  } : null
	});

	var cb = MESSAGE[rname].callback;
	if (MESSAGE[rname].middleware instanceof Middleware){
	  logSocket.debug("[WORKER %d] Request '%s' has middleware...", workerid, rname);
	  var func = MESSAGE[rname].middleware.exec(ctx);
          func.then(function(){
	    logSocket.debug("[WORKER %d] Middleware satisfied for request '%s' on client '%s'", workerid, rname, (co.id !== null) ? co.id : "UNVALIDATED");
            cb(ctx, null);
          }).catch(function(e){
            cb(null, e);
          });
        } else {
	  cb(ctx);
	}
      }
    }
  }

  function ProcessBroadcast(msg, sender, receivers){
    // Using a promise so as to handle this async. Not returning a value, though, so no then() statement.
    new Promise(function(resolve, reject){
      if (receivers.length > 0){
	receivers.forEach(function(rID){
	  if ((rID in CLIENT) && rID !== sender){
	    Sockets.send(rID, msg);
	  }
	});
      } else { // If there are no specific receivers, send to EVERYONE (except the sender).
	Object.Keys(CLIENT).forEach(function(cID){
	  if (cID !== sender){
	    Sockets.send(cID, msg);
	  }
	});
      }
      resolve(); // Do I need to use this, since I'm not returning a value?
    });
  }

  function DropClient(id){
    logSocket.info("[WORKER %d] <Client '%s'> Data will expire in 5 minutes.", workerid, id);
    r.pub.expire(r.Key("visitor", id), 300 /* Five minutes */);
    // Clear the buffer processing timeout
    clearTimeout(CLIENT[id].processID);
    CLIENT[id].client = null; // The client connection is definitely gone. Keeping the rest in case of a reconnect.
    // Use this variable for the expiration timeout.
    CLIENT[id].processID = setTimeout(function(){
      delete CLIENT[id];
      logSocket.info("[WORKER %d] <Client '%s'> connection cleaned.", workerid, id);
    }, 5000*60);
    // Tell any plugin that a client with the given id has been "disconnected"
    emitter.emit("client_disconnected", id);
  }
  

  /**
   * @namespace Sockets
   * @description Manages socket client connections, incomming event handlers, and sending outgoing transmissions to single or multiple clients.
   */
  var Sockets = {
    begin: function(http){
      if (sserver === null){
	sserver = new (require('uws').Server)({server:http});
	sserver.on('connection', function(client){
	  Sockets.connection(client);
	});
      }
      return Sockets;
    },

    
    /**
     * Defines a complete message handler in a single method call. Allows function chaining.
     *
     * @method handler
     * @param {string} name - Name of the message command this handler works with.
     * @param {...middleware} - Zero or more middleware callbacks used to process the message.
     * @param {function} callback - Callback function called after all middleware has completed.
     * @returns {Sockets}
     */
    handler:function(){
      var args = Array.prototype.slice.call(arguments, 0);
      if (args.length < 2){
	if (args.length < 1){
	  logSocket.debug("[WORKER %d] Missing message name.", workerid);
	  throw new Error("Missing message name.");
	}
	logSocket.debug("[WORKER %d] Missing message callback handler function.", workerid);
	throw new Error("Missing message callback handler function.");
      }

      if (typeof(args[0]) !== 'string'){
	logSocket.debug("[WORKER %d] Message name expected to be a string.", workerid);
	throw new TypeError("Message name expected to be a string.");
      }
      if (typeof(args[args.length-1]) !== 'function'){
	logSocket.debug("[WORKER %d] Expected callback function.", workerid);
	throw new TypeError("Expected callback function.");
      }

      var mw = null;
      if (args.length > 2){
	mw = new Middleware(); //args.slice(1, args.length-1);
	for (var i=1; i < args.length-1; i++){
	  if (typeof(args[i]) !== 'function'){
	    logSocket.debug("[WORKER %d] Expected middleware function.", workerid);
	    throw new TypeError("Expected middleware function.");
	  }
          mw.use(args[i]);
	}
      }

      MESSAGE[args[0]] = {
	middleware: mw,
	callback: args[args.length -1]
      };
      return Sockets;
    },

    /**
     * Starts the definition of a message handler. Handler is not finished until finishHandler() is called. Allows function chaining.
     *
     * @method startHandler
     * @param {string} name - Name of the message command this handler works with.
     * @returns {Sockets}
     */
    startHandler:function(name){
      if (OpenMessageHandler !== null){
	delete MESSAGE[OpenMessageHandler];
      }
      MESSAGE[name] = {
	middleware: null,
	callback: null
      };
      OpenMessageHandler = name;
      return Sockets;
    },

    /**
     * Adds middleware to be used with the open handler definition. startHandler() must be called first.
     * Handler is not finished until finishHandler() is called. Allows function chaining.
     * NOTE: Middleware callbacks are executed in the order they are included with this method.
     *
     * @method use
     * @param {function} fn - Middleware callback function to include in handler.
     * @returns {Sockets}
     */
    use:function(fn){
      if (OpenMessageHandler === null){
	logSocket.debug("[WORKER %d] No open message handler started.", workerid);
	throw new Error("No open message handler started.");
      }
      if (typeof(fn) !== 'function'){
	logSocket.debug("[WORKER %d] Expected middleware function.", workerid);
	throw new TypeError("Expected middleware function.");
      }
      if (MESSAGE[OpenMessageHandler].middleware === null){
	MESSAGE[OpenMessageHandler].middleware = [];
      }
      MESSAGE[OpenMessageHandler].middleware.push(fn);
      return Sockets;
    },

    /**
     * Finishes the currently open message handler definition by defining the callback function executed at the end of the middleware chain.
     * startHandler() must be called first. Allows function chaining.
     *
     * @method finishHandler
     * @param {string} name - Name of the message command this handler works with.
     * @returns {Sockets}
     */
    finishHandler:function(cb){
      if (OpenMessageHandler === null){
	logSocket.debug("[WORKER %d] No open message handler started.", workerid);
	throw new Error("No open message handler started.");
      }
      if (typeof(cb) !== 'function'){
	logSocket.debug("[WORKER %d] Expected callback function.", workerid);
	throw new TypeError("Expected callback function.");
      }
      // Convert our array of middleware functions into a middleware object.
      if (MESSAGE[OpenMessageHandler].middleware instanceof Array){
	var mw = new Middleware();
	MESSAGE[OpenMessageHandler].middleware.forEach(function(m){
	  mw.use(m);
	});
	MESSAGE[OpenMessageHandler].middleware = mw;
      }
      // Store the callback
      MESSAGE[OpenMessageHandler].callback = cb;
      return Sockets;
    },


    /**
     * Registers a socket client to manage.
     * NOTE: Client must send a "connection" handshake to be given an ID otherwise client is ignored (soon to be closed).
     *
     * @method connection
     * @param {socket} client - New client socket connection.
     * @returns {Sockets}
     */
    connection:function(client){
      var co = {
	id: null,
	client: client,
	buffer: [],
	processID: null
      };
      
      client.on("message", function(msg){
	logSocket.debug("[WORKER %d] <Client %s> %s", workerid, (co.id !== null) ? co.id : "UNVALIDATED", msg);
	try {
	  ProcessClientMessage(co, msg);
	} catch (e) {
	  ProcessException(e, co.client);
	}
      });

      client.on("close", function(){
	logSocket.info("[WORKER %d] <Client '%s'> Connection closed.", workerid, co.id);
	try {
	  if (co.id !== null){
	    DropClient(co.id);
	  }
	} catch (e) {
	  ProcessException(e);
	}
      });

      logSocket.info("[WORKER %d] New, unvalidated, Client connected.", workerid);
      return Sockets;
    },


    /**
     * Returns true if the given id is a client.
     *
     * @method isClient
     * @param {string} id - The id to check for
     * @returns {boolean}
     */
    isClient:function(id){
      return (id in CLIENT);
    },


    /**
     * Sends msg object to the client with the given id. If immediate is true, the message will not be queued; instead sent immediately.
     * NOTE: This method sends the message object as given after being converted to a JSON string..
     *
     * @method send
     * @param {string} id - The id of the client socket to send to.
     * @param {object} msg - Object to send to the client (as a JSON string)
     * @param {boolean} [immediate=false] - If true, message will be sent immediately instead of being buffered.
     * @returns {Sockets}
     */
    send:function(id, msg, immediate){
      immediate = (immediate === true);
      if (id in CLIENT){
	var co = CLIENT[id];
	if (co.processID === null){
	  co.processID = setTimeout(function(){
	    ProcessClientBuffers(co.id);
	  }, clientBufferTransmitRate);
	}
	
	if (immediate === true){
	  logSocket.debug("[WORKER %d] Sending message to client '%s'.", workerid, co.id);
	  co.client.send((typeof(msg) !== 'string') ? JSON.stringify(msg) : msg);
	} else {
	  logSocket.debug("[WORKER %d] Buffering message to client '%s'.", workerid, co.id);
	  co.buffer.push(msg);
	}
      } else {
	logSocket.error("[WORKER %d] No client with ID '%s'.", workerid, id);
      }
      return Sockets;
    },

    /**
     * Broadcasts the given message object to every connected client.
     * Optionally...
     * If sender id is given, the sender will NOT be included in the broadcast.
     * If a list of "receivers" ids are given, only those clients in the list will recieve the broadcast.
     *
     * @method broadcast
     * @param {object} msg - Object to send to the clients (as a JSON string)
     * @param {string} [sender=null] - ID of the sending client.
     * @param {string[]} [receivers=null] - Array of client id strings to send message to.
     * @returns {Sockets}
     */
    broadcast: function(msg, sender, receivers){
      sender = (typeof(sender) !== 'string') ? null : sender;
      if (typeof(receivers) !== 'undefined' && receivers !== null && receivers.constructor.name !== Array.name){
	receivers = [];
      }
      
      var bdat = {
	message: msg,
	sender: sender,
	receivers: receivers
      };
      r.pub.set(broadcastKey, JSON.stringify(bdat));
      return Sockets;
    }
  };


  Object.defineProperties(Sockets, {
    "workerid":{
      enumerable: true,
      configurable:false,
      writable:false,
      value:workerid
    }
  });


  // Special client request to be handled here.
  Sockets.handler("connection",require('../middleware/connections')(config, r), function(ctx, err){
    if (!err){
      ctx.send();
    } else {
      logSocket.error("[WORKER %d] %s", workerid, err);
    }
  });

  return Sockets;
};
