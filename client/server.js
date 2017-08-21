
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
      ;
    }
  };
  Object.defineProperties(server, {
    "SOCKET":{
      get:function(){return socket;}
    },

    "id":{
      get:function(){return (visitor_data !== null) ? visitor_data.id : "";}
    },

    "username":{
      get:function(){return (visitor_data !== null) ? visitor_data.username : "";}
    }
  });


  
  function MakeConnection(){
    var connectionString = ((options.ssl) ? "wss://" : "ws://") + host + ((options.port !== null) ? ":" + options.port : "");
    socket = new WebSocket(connectionString);
    socket.onclose = function(){
      console.log("Connection to server lost. Checking again in " + options.reconnectDuration + " seconds.");
      setTimeout(function(){MakeConnection();}, options.reconnectDuration*1000);
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
      console.log("Connection re-established.");
      emitter.emit("connected", {
	id: visitor_data.id,
	username: visitor_data.username
      });
    }
  });

  // Kick the pig
  MakeConnection();

  return server;
};
