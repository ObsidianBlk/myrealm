
module.exports = function(cluster, config){
  if (cluster.isWorker !== true){
    throw new Error("Expected to be spawned as a Cluster Worker.");
  }
  console.log("Started Worker " + cluster.worker.id);

  var path = require('path');
  var shortid = require('shortid');
  
  var app = require('express')();
  var server = require('http').createServer(app);
  var socketServer = new (require('uws').Server)({server:server});

  // Configuring server paths
  app.get('/', function(req, res){
    res.sendFile(path.resolve('client/index.html'));
  });

  // serves all the static files
  app.get(/^(.+)$/, function(req, res){ 
    console.log('static file request : ' + req.params);
    res.sendFile(path.resolve('client/' + req.params[0])); 
  });

  socketServer.on('connection', function(client){
    console.log("Client connection made on Worker " + cluster.worker.id + ".");

    client.on("message", function(msg){
      console.log(msg);
    });

    client.on("close", function(){
      console.log("Client connection closed on Worker " + cluster.worker.id + ".");
    });
  });

  // Start the HTTP server
  console.log("Worker " + cluster.worker.id + " starting server on port " + config.http.port);
  server.listen(config.http.port);

};
