
module.exports = function(host, port, reconnectDuration){
  if (typeof(reconnectDuration) !== 'number' || reconnectDuration <= 0){
    reconnectDuration = 5; // In Seconds.
  }

  var user_data = null;
  var currentToken = null;

  var socket = null;
  function MakeConnection(){
    socket = new WebSocket('ws://' + host + ':' + port);
    socket.onclose = function(){
      console.log("Connection to server lost. Checking again in " + reconnectDuration + " seconds.");
      setTimeout(function(){MakeConnection();}, reconnectDuration*1000);
    };

    socket.onopen = function (event) {
      console.log("Socket connected to server!");
      var req = {req:"connection"};
      if (currentToken !== null){
	req.data = user_data;
	req.token = currentToken;
      }
      socket.send(JSON.stringify(req));
    };

    socket.onmessage = function(event){
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
    };
  }
  MakeConnection();



  var Messenger = {};
  Object.defineProperties(Messenger, {
    "socket":{
      get:function(){return socket;}
    }
  });


  return Messenger;
};
