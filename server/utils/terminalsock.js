var net = require('net');
var shortid = require('shortid');
var emitter = new (require('../mediator/aemitter'))();
var allowConnections = true;
var server = null;
var connections = {};

module.exports = function(host, port, maxConnections, authCode){
  if (server === null){
    function ErrorOut(c, msg, closeOnSend){
      c.write(JSON.stringify({
	status: "error",
	message: msg
      }));
      if (closeOnSend === true){
	c.end(JSON.stringify({
	  status: "end",
	  message: "Connection terminated."
	}));
      }
    }
    
    server = net.createServer(function(c){
      if (allowConnections === false){
	ErrorOut(c, "Server not allowing connections.", true);
	return;
      }
      
      var id = shortid();
      // NOTE: With limited connections, id should never be duplicated... at least, that's the assumption by just doing this strait on!
      connections[id] = {client: c, authorized: false};

      
      c.on('data', function(data){
	if (!(id in connections)){
	  ErrorOut(c, "Connection not registered... terminating loose connection.", true);
	  return; // Done here
	}
	
	var msg = null;
	try {
	  msg = JSON.parse(data);
	} catch (e) {
	  if (connections[id].authorized === true){
	    ErrorOut(c, "Invalid data structure... " + e.message);
	  } else {
	    ErrorOut(c, "Invalid data structure... terminating connection.", true);
	  }
	  return; // Done here
	}

	if (!msg.cmd){
	  ErrorOut(c, "JSON invalid... terminating connection.", true);
	  return; // Done here
	}

	emitter.emit(msg.cmd, {
	  client: c,
	  id: id,
	  authorized: connections[id].authorized,
	  data: msg.data
	});
      });

      c.on('close', function(){
	if (id in connections){
	  delete connections[id];
	}
      });
    });

    server.on("close", function(){
      server = null;
    });

    emitter.on("close", function(c){
      c.client.end(JSON.stringify({
	status: "end",
	message: "Connection closed."
      }));
      if (c.id in connections){
	delete connections[c.id];
      }
    });

    emitter.on("authorize", function(c){
      if (typeof(connections[c.id]) !== 'undefined'){
	if (c.data.code) {
	  if (c.data.code === authCode){
	    connections[c.id].authorized = true;
	    c.client.write(JSON.stringify({
	      status: "success"
	    }));
	    return;
	  }
	}
      }
      ErrorOut(c.client, "Client data error... terminating connection.", true);
    });
    
    server.maxConnections = maxConnections;
    server.listen(port, host);
  }


  // --------------------------

  var obj = {};
  Object.defineProperties(obj, {
    "serverOpen":{
      enumerable: true,
      get:function(){return server !== null;}
    },

    "allowingConnection":{
      enumerable: true,
      get:function(){return allowConnections;}
    },
    
    "clients":{
      enumerable: true,
      get:function(){
	var keys = Object.keys(connections);
	return keys.length;
      }
    },

    "authorized":{
      enumerable: true,
      get:function(){
	var keys = Object.keys(connections);
	var count = 0;
	keys.forEach(function(key){
	  count += (connections[key].authorized) ? 1 : 0;
	});
	return count;
      }
    },
    
    "on":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: emitter.on
    },

    "errorOut":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: ErrorOut
    }
  });

  obj.dropClients = function(closeServer){
    allowConnections = false;
    var keys = Object.keys(connections);
    keys.forEach(function(key){
      connections[key].client.end(JSON.stringify({
	status: "end",
	message: "Connection closed by server."
      }));
    });
    if (closeServer === true){
      server.close();
    } else {
      allowConnections = true;
    }
  };

  obj.close = function(dropClients){
    if (dropClients === true){
      this.dropClients(true);
    } else {
      server.close();
    }
  };

  return obj;
};
