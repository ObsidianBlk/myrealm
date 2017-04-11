
// TODO: Remember hellojs as a possible social auth middleware.


module.exports = function(workerid, config, r){
  var Promise = require('bluebird');
  var Middleware = require('./middleware');
  var CreateContext = require('./context');
  var Logger = require('./logger')(config.logging);
  var logSocket = new Logger(config.logDomain + ":sockets");
  var logDispatch = new Logger(config.logDomain + ":dispatch");

  var CLIENT = {};
  var MESSAGE = {};
  var OpenMessageHandler = null;

  var broadcastKey = r.Key("INTERNAL", "BROADCAST");
  r.sub.on(broadcastKey, function(channel, message){
    var broadcast = JSON.parse(message);
    ProcessBroadcast(broadcast.message, broadcast.sender, broadcast.receiver);
  });
  r.sub.subscribe(broadcastKey);
  

  function ProcessException(e, client){
    logDispatch.error("[WORKER %d] %s", workerid, e.message);
    if (typeof(client) !== 'undefined'){
      client.send(JSON.stringify({
	status: "F",
	error: e.message
      }));
    }
  }

  function ProcessClientBuffers(id){
    var timeout = 1000*(1/60); // TODO: Make this a config variable.
    var co = CLIENT[id];
    var buff = null;

    switch(co.buffer.length){
    case 0: // Nothing to send...
      break;
    case 1: // Send the 0th entry directly.
      buff = co.buffer;
      co.buffer = [];
      logDispatch.debug("[WORKER %d] Sending command to client '%s'.", workerid, co.id);
      co.client.send(JSON.stringify(buff[0]));
      break;
    default: // Send all msgs in a special command.
      buff = co.buffer;
      co.buffer = [];
      logDispatch.debug("[WORKER %d] Sending buffered commands to client '%s'.", workerid, co.id);
      co.client.send(JSON.stringify({
	cmds:buff
      }));
    }

    // Wait for the next timeout to process.
    co.processID = setTimeout(function(){
      ProcessClientBuffers(id);
    }, timeout);
  }

  function ProcessClientMessage(co, msg){
    logDispatch.debug("[WORKER %d] Processing message for '%s'.", workerid, (co.id !== null) ? co.id : "UNVALIDATED");
    if (typeof(msg) === 'string'){
      try {
	msg = JSON.parse(msg);
      } catch (e) {
	logDispatch.warning("[WORKER %d] Client request not a valid JSON object.", workerid);
	return;
      }
    }
    
    if ("req" in msg){
      var rname = msg["req"];
      if (rname in MESSAGE){
	var ctx = CreateContext(co, msg, Dispatch);

	var cb = MESSAGE[rname].callback;
	if (MESSAGE[rname].middleware instanceof Middleware){
	  logDispatch.debug("[WORKER %d] Request '%s' has middleware...", workerid, rname);
	  var func = MESSAGE[rname].middleware.exec(ctx);
          func.then(function(){
	    logDispatch.debug("[WORKER %d] Middleware satisfied for request '%s' on client '%s'", workerid, rname, (co.id !== null) ? co.id : "UNVALIDATED");
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
	    Dispatch.send(rID, msg);
	  }
	});
      } else { // If there are no specific receivers, send to EVERYONE (except the sender).
	Object.Keys(CLIENT).forEach(function(cID){
	  if (cID !== sender){
	    Dispatch.send(cID, msg);
	  }
	});
      }
      resolve(); // Do I need to use this, since I'm not returning a value?
    });
  }

  function DropClient(id){
    logDispatch.info("[WORKER %d] <Client '%s'> Data will expire in 5 minutes.", workerid, id);
    r.pub.expire(r.Key("visitor", id), 300 /* Five minutes */);
    // Clear the buffer processing timeout
    clearTimeout(CLIENT[id].processID);
    CLIENT[id].client = null; // The client connection is definitely gone. Keeping the rest in case of a reconnect.
    // Use this variable for the expiration timeout.
    CLIENT[id].processID = setTimeout(function(){
      delete CLIENT[id];
      logDispatch.info("[WORKER %d] <Client '%s'> connection cleaned.", workerid, id);
    }, 5000*60);
  }
  
  
  var Dispatch = {
    // @param name Message name that triggers this handler.
    // @param [middleware, ...] Zero or more middleware used to process the message.
    // @param callback Function called to finalize the message.
    handler:function(){
      var args = Array.prototype.slice.call(arguments, 0);
      if (args.length < 2){
	if (args.length < 1){
	  logDispatch.debug("[WORKER %d] Missing message name.", workerid);
	  throw new Error("Missing message name.");
	}
	logDispatch.debug("[WORKER %d] Missing message callback handler function.", workerid);
	throw new Error("Missing message callback handler function.");
      }

      if (typeof(args[0]) !== 'string'){
	logDispatch.debug("[WORKER %d] Message name expected to be a string.", workerid);
	throw new TypeError("Message name expected to be a string.");
      }
      if (typeof(args[args.length-1]) !== 'function'){
	logDispatch.debug("[WORKER %d] Expected callback function.", workerid);
	throw new TypeError("Expected callback function.");
      }

      var mw = null;
      if (args.length > 2){
	mw = new Middleware(); //args.slice(1, args.length-1);
	for (var i=1; i < args.length-1; i++){
	  if (typeof(args[i]) !== 'function'){
	    logDispatch.debug("[WORKER %d] Expected middleware function.", workerid);
	    throw new TypeError("Expected middleware function.");
	  }
          mw.use(args[i]);
	}
      }

      MESSAGE[args[0]] = {
	middleware: mw,
	callback: args[args.length -1]
      };
      return this;
    },

    startHandler:function(name){
      if (OpenMessageHandler !== null){
	delete MESSAGE[OpenMessageHandler];
      }
      MESSAGE[name] = {
	middleware: null,
	callback: null
      };
      OpenMessageHandler = name;
      return this;
    },

    use:function(fn){
      if (OpenMessageHandler === null){
	logDispatch.debug("[WORKER %d] No open message handler started.", workerid);
	throw new Error("No open message handler started.");
      }
      if (typeof(fn) !== 'function'){
	logDispatch.debug("[WORKER %d] Expected middleware function.", workerid);
	throw new TypeError("Expected middleware function.");
      }
      if (MESSAGE[OpenMessageHandler].middleware === null){
	MESSAGE[OpenMessageHandler].middleware = [];
      }
      MESSAGE[OpenMessageHandler].middleware.push(fn);
      return this;
    },

    finishHandler:function(cb){
      if (OpenMessageHandler === null){
	logDispatch.debug("[WORKER %d] No open message handler started.", workerid);
	throw new Error("No open message handler started.");
      }
      if (typeof(cb) !== 'function'){
	logDispatch.debug("[WORKER %d] Expected callback function.", workerid);
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
      return this;
    },

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

      logDispatch.info("[WORKER %d] New, unvalidated, Client connected.", workerid);
    },


    send:function(id, msg, immediate){
      immediate = (immediate === true);
      if (id in CLIENT){
	var co = CLIENT[id];
	if (immediate === true){
	  logDispatch.debug("[WORKER %d] Sending message to client '%s'.", workerid, co.id);
	  co.client.send((typeof(msg) !== 'string') ? JSON.stringify(msg) : msg);
	} else {
	  logDispatch.debug("[WORKER %d] Buffering message to client '%s'.", workerid, co.id);
	  co.buffer.push(msg);
	}
      } else {
	logDispatch.error("[WORKER %d] No client with ID '%s'.", workerid, id);
      }
    },

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
    }
  };


  Dispatch.handler("connection", require('./middleware/connections')(config, r), function(ctx, err){
    if (!err){
      if (typeof(ctx.co) !== 'undefined'){
	CLIENT[ctx.co.id] = ctx.co;
	ctx.co.processID = setTimeout(function(){
	  ProcessClientBuffers(ctx.co.id);
	}, (1/60)*1000);
	logDispatch.debug("[WORKER %d] connection request complete. Client ID '%s'.", workerid, ctx.co.id);
      }
      ctx.send();
    } else {
      logDispatch.error("[WORKER %d] %s", workerid, err);
    }
  });

  return Dispatch;
};
