
// TODO: Remember hellojs as a possible social auth middleware.


module.exports = function(workerid, config, r){
  var shortid = require('shortid');
  var Promise = require('bluebird');
  var Middleware = require('./middleware');
  var Logger = require('./logger')(config.logging);
  var logSocket = new Logger("homegrid:sockets");
  var logDispatch = new Logger("homegrid:dispatch");

  var CLIENT = {};
  var MESSAGE = {};
  var OpenMessageHandler = null;

  function GenerateVisitorID(attempts){
    return new Promise(function(resolve, reject){
      var id = shortid();
      r.pub.hget(r.Key(config.serverkey, "visitor", id), function(err, obj){
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
	    resolve(id);
	  }
	}
      });
    });
  }

  function ProcessException(e, client){
    logDispatch.error("[WORKER %d] %s", workerid, e.message);
    if (typeof(client) !== 'undefined'){
      client.send(JSON.stringify({
	error: e.message
      }));
    }
  }

  function ProcessClientMessage(id, client, msg){
    var data = JSON.parse(msg);
    if ("request" in data){
      var rname = data["request"];
      if (rname in MESSAGE){
        var ctx = {
          id: id,
          client: client,
          request: data,
          response: {}
        };

	var cb = MESSAGE[rname].callback;
	if (MESSAGE[rname].middleware instanceof Middleware){
	  var func = MESSAGE[rname].middleware.exec(ctx);
          func.then(function(){
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
    delete CLIENT[id];
    logDispatch.info("[WORKER %d] <Client '%s'> Removed from grid.", workerid, id);
  }
  
  
  return {
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
      GenerateVisitorID(10).then(function(id){
	client.on("message", function(msg){
	  logSocket.debug("[WORKER %d] <Client %s> %s", workerid, id, msg);
	  try {
	    ProcessClientMessage(id, client, msg);
	  } catch (e) {
	    ProcessException(e, client);
	  }
	});

	client.on("close", function(){
	  logSocket.info("[WORKER %d] <Client '%s'> Connection closed.", workerid, id);
	  try {
	    DropClient(id);
	  } catch (e) {
	    ProcessException(e);
	  }
	});

	CLIENT[id] = client;
	logDispatch.info("[WORKER %d] New Client added with ID '%s'.", workerid, id);
	client.send("Hello there"); // TODO: You know... something FAR more appropriate!
      }).catch(function(e){
	logDispatch.error("[WORKER %d] %s", workerid, e.message);
      });
      return this;
    }
  };
};
