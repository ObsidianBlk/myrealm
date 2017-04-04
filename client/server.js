
module.exports = function(emitter, host, options){
  if (options.constructor.name !== Object.name){
    options = {};
  }
  if (typeof(options.reconnectDuration) !== 'number' || options.reconnectDuration <= 0){
    options.reconnectDuration = 5; // In Seconds.
  }
  if (typeof(options.port) !== 'number' || options.port <= 0){
    options.port = 3000;
  }
  options.ssl = (options.ssl === true);


  var user_data = null;
  var currentToken = null;
  var socket = null;

  
  var server = {
    send: function(name, payload){
      var request = {
	req:name
      };
      if (typeof(payload) !== 'undefined' && payload !== null){
	request.data = payload;
      }
      if (currentToken !== null){
	request.token = currentToken;
      }
      if (socket !== null){
	socket.send(JSON.stringify(request));
      }
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
    var connectionString = ((options.ssl) ? "wss://" : "ws://") + host + ":" + options.port;
    socket = new WebSocket(connectionString);
    socket.onclose = function(){
      console.log("Connection to server lost. Checking again in " + options.reconnectDuration + " seconds.");
      setTimeout(function(){MakeConnection();}, options.reconnectDuration*1000);
    };

    socket.onopen = function (event) {
      console.log("Socket connected to server!");
      server.send("connection", user_data);
    };

    socket.onmessage = function(event){
      var msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.error("Received invalid data packet.");
	return;
      }
      
      if ("cmd" in msg){
	var cname = msg["cmd"];
	emitter.emit(cname, msg, server);
      }
    };
  }

  // Listening for "connection" status from the server.
  emitter.listen("connection", function(msg){
    if (msg.status === "error"){
      console.error("CONNECTION ERROR: " + msg.message);
    } else {
      user_data = msg.data;
      currentToken = msg.token;
      console.log("[CONNECTION ESTABLISHED] Username: " + user_data.username);
    }
  });

  // Kick the pig
  MakeConnection();

  return server;
};
