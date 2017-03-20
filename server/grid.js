
// TODO: Remember hellojs as a possible social auth middleware.


module.exports = function(workerid, config, r){
  var shortid = require('shortid');
  var Middleware = require('./middleware');
  var Logger = require('./logger')(config.logging);
  var logSocket = new Logger("homegrid:sockets");
  var logGrid = new Logger("homegrid:grid");

  var CLIENT = {};
  var MESSAGE = {};

  function NewID(attempts){
    var id = null;
    // Keep looping until we have a unique id value or the number of attempts has been exceeded.
    // NOTE: This should not fail unless there's an exceedingly large (millions?) number of connections to the server.
    while (attempts > 0 && ((id = workerid.toString() + shortid()) in CLIENT)){attempts--;}
    if (attempts <= 0){
      throw new Error("Failed to generate ID for client.");
    }
    return id;
  }

  function ProcessException(e, client){
    logGrid.error("[WORKER %d] %s", workerid, e.message);
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
	var func = MESSAGE[rname].middleware.exec(ctx);
	var cb = MESSAGE[rname].callback;
        func.then(function(){
          cb(ctx, null);
        }).catch(function(e){
          cb(null, e);
        });
        
      }
    }
  }

  function DropClient(id){
    // TODO: Drop any redis data.
    delete CLIENT[id];
    logGrid.info("[WORKER %d] <Client '%s'> Removed from grid.", workerid, id);
  }
  
  
  return {
    // @param name Message name that triggers this handler.
    // @param [middleware, ...] Zero or more middleware used to process the message.
    // @param callback Function called to finalize the message.
    handleMessage:function(){
      var args = Array.prototype.slice.call(arguments, 0);
      if (args.length < 2){
	if (args.length < 1){
	  throw new Error("Missing message name.");
	}
	throw new Error("Missing message callback handler function.");
      }

      if (typeof(args[0]) !== 'string'){
	throw new TypeError("Message name expected to be a string.");
      }
      if (typeof(args[args.length-1]) !== 'function'){
	throw new TypeError("Expected callback function.");
      }

      var mw = null;
      if (args.length > 2){
	mw = new Middleware(); //args.slice(1, args.length-1);
	for (var i=1; i < args.length-1; i++){
	  if (typeof(args[i]) !== 'function'){
	    throw new TypeError("Expected middleware function.");
	  }
          mw.use(args[i]);
	}
      }

      MESSAGE[args[0]] = {
	middleware: mw,
	callback: args[args.length -1]
      };
    },
    
    connection:function(client){
      var id = null;
      try {
	id = NewID(10);
      } catch (e){
	ProcessException(e, client);
	return;
      }
      
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
      logGrid.info("[WORKER %d] New Client added with ID '%s'.", workerid, id);
    }
  };
};
