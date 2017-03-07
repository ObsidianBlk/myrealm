
module.exports = function(cluster){
  if (cluster.isWorker !== true){
    throw new Error("Expected to be spawned as a Cluster Worker.");
  }
  console.log("Started Worker " + cluster.worker.id);

  var path = require('path');
  var shortid = require('shortid');
  
  var app = require('express')();
  var server = require('http').createServer(app);
  var io = require('socket.io').listen(server);
  var redis = require('socket.io-redis');
  io.adapter(redis({host:'localhost', port:6379}));

  // Configuring server paths
  app.get('/', function(req, res){
    res.sendfile(path.resolve('client/index.html'));
  });

  // serves all the static files
  app.get(/^(.+)$/, function(req, res){ 
    console.log('static file request : ' + req.params);
    res.sendfile(path.resolve('client/' + req.params[0])); 
  });

  // Start the HTTP server
  console.log("Starting the server");
  server.listen(3000);


  // Configuring Socket.io sockets...
  io.sockets.on('connection', function(socket){
    socket.id = shortid.generate();
    console.log("Socket " + socket.id + " connected to Worker " + cluster.worker.id + ".");
    
    socket.on("disconnect", function(){
      console.log("Socket " + socket.id + " disconnected from Worker " + cluster.worker.id + ".");
    });
  });
};
