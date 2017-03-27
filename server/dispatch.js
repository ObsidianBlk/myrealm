
// TODO: Remember hellojs as a possible social auth middleware.


module.exports = function(workerid, config, r){
  var shortid = require('shortid');
  var Promise = require('bluebird');
  var Middleware = require('../common/middleware');
  var CreateContext = require('./context');
  var Logger = require('./logger')(config.logging);
  var logSocket = new Logger("homegrid:sockets");
  var logDispatch = new Logger("homegrid:dispatch");

  var CLIENT = {};
  var MESSAGE = {};
  var OpenMessageHandler = null;

  function GenerateVisitorID(attempts){
    return new Promise(function(resolve, reject){
      var id = shortid();
      var key = r.Key(config.serverkey, "visitor", id);
      r.pub.hgetall(key, function(err, obj){
	if (err){
	  logDispatch.error("[WORKER %d] %s", workerid, err);
	  reject(err);
	} else {
	  if (obj.length > 0){
	    if (attempts > 0){
	      resolve(GenerateVisitorID(attempts-1));
	    } else {
	      reject(new Error("Failed to obtain a unique visitor ID."));
	    }
	  } else {
	    r.pub.hmset(key, {
	      username: "USER_" + id,
	      validated: false
	    }, function(err){
	      if (err){
		reject(new Error("Failed to generate hash for new visitor ID '" + id + "'. \"" + err + "\"."));
	      }
	      resolve(id);
	    });
	  }
	}
      });
    });
  }

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
    logDispatch.debug("[WORKER %d] Processing message for '%s'.", workerid, co.id);
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
	var ctx = CreateContext(co.id, co.client, msg, Dispatch);

	var cb = MESSAGE[rname].callback;
	if (MESSAGE[rname].middleware instanceof Middleware){
	  logDispatch.debug("[WORKER %d] Request '%s' has middleware...", workerid, rname);
	  var func = MESSAGE[rname].middleware.exec(ctx);
          func.then(function(){
	    logDispatch.debug("[WORKER %d] Middleware satisfied for request '%s' on client '%s'", workerid, rname, co.id);
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

  function DropClient(id){
    // TODO: Drop any redis data.
    r.pub.del(r.Key(config.serverkey, "visitor", id), function(err, reply){
      if (err){
	logDispatch.error("[WORKER %d] %o", workerid, err);
      }
      if (reply !== 1){
	logDispatch.error("[WORKER %d] Failed to remove ID '%s' from cache server.", workerid, id);
      }
      clearTimeout(CLIENT[id].processID);
      delete CLIENT[id];
      logDispatch.info("[WORKER %d] <Client '%s'> Removed from grid.", workerid, id);
    });
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
      function BuildClientObj(c, id){
	return {
	  id: id,
	  client: c,
	  buffer: [],
	  processID: setTimeout(function(){
	    ProcessClientBuffers(id);
	  }, 1000*(1/60))
	};
      }

      function DefineClientEvents(co){
	co.client.on("message", function(msg){
	  logSocket.debug("[WORKER %d] <Client %s> %s", workerid, co.id, msg);
	  try {
	    ProcessClientMessage(co, msg);
	  } catch (e) {
	    ProcessException(e, co.client);
	  }
	});

	co.client.on("close", function(){
	  logSocket.info("[WORKER %d] <Client '%s'> Connection closed.", workerid, co.id);
	  try {
	    DropClient(co.id);
	  } catch (e) {
	    ProcessException(e);
	  }
	});
	CLIENT[co.id] = co;
	logDispatch.info("[WORKER %d] New Client added with ID '%s'.", workerid, co.id);
      }
      
      GenerateVisitorID(10).then(function(id){
	DefineClientEvents(BuildClientObj(client, id));
	// Faking a request to kick the pig.
	ProcessClientMessage(CLIENT[id], {
	  req: "connection"
	}, true);
      }).catch(function(e){
	logDispatch.error("[WORKER %d] %s", workerid, e.message);
      });
      return this;
    },

    send:function(id, msg, immediate){
      immediate = (immediate === true);
      if (id in CLIENT){
	var co = CLIENT[id];
	if (immediate === true){
	  logDispatch.debug("[WORKER %d] Sending message to client '%s'.", workerid, co.id);
	  co.client.send(JSON.stringify(msg));
	} else {
	  logDispatch.debug("[WORKER %d] Buffering message to client '%s'.", workerid, co.id);
	  co.buffer.push(msg);
	}
      } else {
	logDispatch.error("[WORKER %d] No client with ID '%s'.", workerid, id);
      }
    },

    broadcast: function(msg, fromid){
      // TODO: Flesh this out!
    }
  };


  Dispatch.handler("connection", function(ctx, err){
    if (!err){
      ctx.response.cmd = "connrecognize";
      ctx.response.data = {
	id:ctx.id
      };
      ctx.send();
    }
  });


  return Dispatch;
};
