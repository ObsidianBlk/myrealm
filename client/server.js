
module.exports = function(emitter, host, options){
  if (options.constructor.name !== Object.name){
    options = {};
  }
  if (typeof(options.reconnectDuration) !== 'number' || options.reconnectDuration <= 0){
    options.reconnectDuration = 5; // In Seconds.
  }
  if (typeof(options.port) !== 'number' || options.port <= 0){
    options.port = null;
  }
  options.ssl = (options.ssl === true);
  var Crypto = require('crypto-js');


  var visitor_data = null;
  var currentToken = null;
  var socket = null;
  var revalidateTimeout = null;

  var awaitingValidation = false;
  var requestBuffer = [];


  
  var server = {
    send: function(name, payload){
      var request = {
	type:name
      };
      if (typeof(payload) !== 'undefined' && payload !== null){
	request.data = payload;
      }
      if (awaitingValidation === false){
	if (requestBuffer.length > 0){
	  requestBuffer.push(request);
	  server.flush();
	} else {
	  if (currentToken !== null){
	    request.hmac = Crypto.HmacSHA256(JSON.stringify(request), currentToken).toString(Crypto.enc.Hex);
	  }
	  if (socket !== null){
	    socket.send(JSON.stringify(request));
	  }
	}
      } else {
	// Store request for after revalidation completes.
	requestBuffer.push(request);
      }
    },

    // Send all of the buffered requests.
    flush: function(){
      // Don't flush if waiting for validation. Doing so may make some requests invalid due to incorrect token.
      if (awaitingValidation === true){return;}
      
      if (requestBuffer.length > 0){
	var rbuffer = requestBuffer.slice(); // Quick copy... in case sending the data is async (I'm not sure ATM).
	requestBuffer.splice(0);
	
	if (currentToken !== null){
	  rbuffer.forEach(function(req){
	    req.hmac = Crypto.HmacSHA256(JSON.stringify(req), currentToken).toString(Crypto.enc.Hex);
	  });
	}
	if (socket !== null){
	  var msg = {
	    type:"multi",
	    data: rbuffer
	  };
	  msg.hmac = Crypto.HmacSHA256(JSON.stringify(msg), currentToken).toString(Crypto.enc.Hex);
	  socket.send(JSON.stringify(msg));
	}
	requestBuffer.splice(0);
      }
    },

    revalidate: function(){
      // Don't revalidate if waiting for validation or if we haven't registered yet. Doing so is just stupid!
      if (currentToken === null || awaitingValidation === true){return;}

      // Clear any current revalidation timer. Don't want to trip over myself!
      if (revalidateTimeout !== null){
	clearTimeout(revalidateTimeout);
	revalidateTimeout = null;
      }
      
      awaitingValidation = true;
      var msg = {
	type:"validate"
      };
      msg.hmac = Crypto.HmacSHA256(JSON.stringify(msg), currentToken).toString(Crypto.enc.Hex);
      console.log("REVALIDATING");
      socket.send(JSON.stringify(msg));
    },

    getCurrentInformation: function(){
      return (visitor_data !== null) ? JSON.parse(JSON.stringify(visitor_data)) : null;
    }
  };
  Object.defineProperties(server, {
    "SOCKET":{
      get:function(){return socket;}
    },

    "connected":{
      get:function(){return (socket !== null);}
    },

    "awaitingValidation":{
      get:function(){return awaitingValidation;}
    },

    "id":{ // TODO: Deprecate
      get:function(){return (visitor_data !== null) ? visitor_data.id : "";}
    },

    "username":{ // TODO: Deprecate
      get:function(){return (visitor_data !== null) ? visitor_data.username : "";}
    }
  });


  
  function MakeConnection(){
    var connectionString = ((options.ssl) ? "wss://" : "ws://") + host + ((options.port !== null) ? ":" + options.port : "");
    socket = new WebSocket(connectionString);
    socket.onclose = function(){
      console.log("Connection to server lost. Checking again in " + options.reconnectDuration + " seconds.");
      // Clear any revalidation timeout...
      ClearRevalidationTimeout();
      // Now setup a timeout to try to reconnect to server... wheee!
      setTimeout(function(){MakeConnection();}, options.reconnectDuration*1000);
      socket = null; // Clear the old socket.
    };

    socket.onopen = function (event) {
      console.log("Socket connected to server!");
      if (visitor_data !== null){
	console.log("Requesting to re-establish old connection.");
	server.send("reestablish", visitor_data);
      } else {
	server.send("connection");
      }
      awaitingValidation = true;
    };

    socket.onmessage = function(event){
      var msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.error("Received invalid data packet.");
	return;
      }
      
      if ("type" in msg){
	var hasHMAC = ("hmac" in msg);
	if (msg.type !== 'connection' && !hasHMAC){
	  console.error("HMAC hash missing for message '" + msg.type + "'");
	  return;
	} else if (hasHMAC === true){
	  var msghmac = msg.hmac;
	  delete msg.hmac;
	  var hash = Crypto.HmacSHA256(JSON.stringify(msg), currentToken).toString(Crypto.enc.Hex);
	  if (hash !== msghmac){
	    console.error("HMAC hash mismatch. Message possibly modified!");
	    return;
	  }
	  msg.hmac = msghmac;
	}
	emitter.emit(msg.type, msg.data, msg, server);
      }
    };
  }

  // ----------------------------------------------------------------------
  // HELPER FUNCTIONS

  function TimeToNextRevalidation(expiration){
    // Given <expiration> time in seconds. Can't use that value exactly, as the token may expire an instant before making a request.
    // Therefore, we wait for only 85% of that given time (rounded to the nearest whole second), then multiply by 1000 to turn it into
    // milliseconds. Boy... ain't I a genious! *cough*
    var reval_time = Math.floor(expiration * 0.85) * 1000;
    // Of course, if we're given a rediculously low expiration time, we'll just wait 100 milliseconds.
    if (reval_time < 100){
      reval_time = 100;
    }

    ClearRevalidationTimeout();
    
    revalidateTimeout = setTimeout(function(){
      server.revalidate();
    }, reval_time);
  }


  function ClearRevalidationTimeout(){
    if (revalidateTimeout !== null){
      clearTimeout(revalidateTimeout);
      revalidateTimeout = null;
    }
  }


  
  //------------------------------------------------------------------------
  // MESSAGE EVENT HANDLERS

  // Listening for special case message type "multi" in which the data should be an array or message objects.
  emitter.on("multi", function(data){
    console.log("Processing MULTI message.");
    if (data instanceof Array){
      data.forEach(function(item){
	if ("type" in item){
	  // TODO: Each message in the multi-message should also contain hmac hash values, and none of the messages should be
	  // transmitted until all hmacs are verified. If even one failed, none of the messages should be processed.
	  emitter.emit(item.type, item.data, item, server);
	}
      });
    }
  });

  // Listening for "connection" status from the server.
  emitter.on("connection", function(data, msg){
    if (msg.status === "error"){
      console.error("CONNECTION ERROR: " + msg.message);
      awaitingValidation = false;
      emitter.emit("connection_error");
    } else {
      visitor_data = data.vdata;
      currentToken = data.token;
      awaitingValidation = false;
      TimeToNextRevalidation(data.token_expiration);
      console.log("[CONNECTION ESTABLISHED] Username: " + visitor_data.username);
      emitter.emit("connected", {
	id: visitor_data.id,
	username: visitor_data.username
      });
    }
  });

  emitter.on("reestablish", function(data, msg){
    if (msg.status === "error"){
      console.error("FAILED TO RE-ESTABLISH CONNECTION: " + msg.message);
      visitor_data = null;
      currentToken = null;
      awaitingValidation = false;
      console.log("Attempting a new connection with server.");
      server.send("connection");
      awaitingValidation = true;
    } else {
      visitor_data = data.vdata;
      currentToken = data.token;
      awaitingValidation = false;
      TimeToNextRevalidation(data.token_expiration);
      console.log("Connection re-established.");
      emitter.emit("connected", {
	id: visitor_data.id,
	username: visitor_data.username
      });
    }
  });

  emitter.on("validate", function(data, msg){
    if (msg.status === "error"){
      console.error("FAILED REVALIDATION: " + msg.message);
      // Going to try and keep going with current token.
      // TODO: Ummm... do something better.
      awaitingValidation = false;
    } else {
      awaitingValidation = false;
      visitor_data = data.vdata;
      currentToken = data.token;
      TimeToNextRevalidation(data.token_expiration);
      console.log("Connection re-validated");
    }
  });

  // Kick the pig
  MakeConnection();

  return server;
};
