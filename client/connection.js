
module.exports = function(host, options){
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

  
  var Middleware = require('../common/middleware');

  var MESSAGE = {};
  var OpenMessageHandler = null;
  
  var user_data = null;
  var currentToken = null;
  var socket = null;

  var activeRequest = null;

  
  var connection = {
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
	throw new Error("No open message handler started.");
      }
      if (typeof(fn) !== 'function'){
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
	throw new Error("No open message handler started.");
      }
      if (typeof(cb) !== 'function'){
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
    }
  };
  Object.defineProperties(connection, {
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
      connection.send("connection", user_data);
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
	if (cname in MESSAGE){
	  // TODO: Make a Client side context object.
	  var ctx = {
	    command: msg,
	    response: {}
	  };

	  var cb = MESSAGE[cname].callback;
	  if (MESSAGE[cname].middleware instanceof Middleware){
	    var func = MESSAGE[cname].middleware.exec(ctx);
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
      /*
	console.log("Obtained a message.");
      console.log(event);
      var msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.log("Failed to parse server message.");
      }

      if (msg !== null){
        console.log(msg);
        if (msg.cmd === "connection"){
	  if (msg.status === "error"){
	    console.log(msg.message);
	  } else {
	    user_data = msg.data;
	    currentToken = msg.token;
	    console.log("ID: " + user_data.id);
	    console.log("USERNAME: " + user_data.username);
	    console.log("TOKEN: " + currentToken);
	  }
        }
      }
      */
    };
  }
  MakeConnection();

  return connection;
};
