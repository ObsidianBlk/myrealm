
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


  var user_data = null;
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
	    request.token = currentToken;
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
	if (currentToken !== null){
	  requestBuffer.forEach(function(req){
	    req.token = currentToken;
	  });
	}
	if (socket !== null){
	  socket.send(JSON.stringify({
	    cmd:"multi",
	    data: requestBuffer.slice() // Quick copy... in case sending the data is async (I'm not sure ATM).
	  }));
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
      get:function(){return (user_data !== null) ? user_data.id : "";}
    },

    "username":{
      get:function(){return (user_data !== null) ? user_data.username : "";}
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
      server.send("connection", user_data);
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
      user_data = data;
      currentToken = msg.token;
      awaitingValidation = false;
      console.log("[CONNECTION ESTABLISHED] Username: " + user_data.username);
      emitter.emit("connected", {
	id: user_data.id,
	username: user_data.username
      });
    }
  });

  // Kick the pig
  MakeConnection();

  return server;
};
