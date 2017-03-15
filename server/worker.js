
module.exports = function(cluster, config){
  if (cluster.isWorker !== true){
    throw new Error("Expected to be spawned as a Cluster Worker.");
  }

  // -------------------------------------------
  // -- Setting up logging
  var Logger = require('./logger')(config.logging);
  var logWorker = new Logger("homegrid:worker");
  var logHTTP = new Logger("homegrid:http");
  var logSocket = new Logger("homegrid:sockets");
  var logRedis = new Logger("homegrid:redis");
  

  logWorker.info("Started Worker %d", cluster.worker.id);

  // -------------------------------------------
  // -- Getting basic modules
  var path = require('path');
  var shortid = require('shortid');
  var moment = require('moment');

  // -------------------------------------------
  // -- Setting up Redis Pub/Sub connections...
  var r = require('./redisPubSub')(cluster.worker.id, logRedis, config.redis);

  // -------------------------------------------
  // -- Getting HTTP and Socket servers
  var app = require('express')();
  var server = require('http').createServer(app);
  var socketServer = new (require('uws').Server)({server:server});

  // Configuring server paths
  app.get('/', function(req, res){
    res.sendFile(path.resolve('client/index.html'));
  });

  // serves all the static files
  app.get(/^(.+)$/, function(req, res){
    logHTTP.debug("[WORKER %d] Static file request: %o", cluster.worker.id, req.params);
    //console.log('static file request : ' + req.params);
    res.sendFile(path.resolve('client/' + req.params[0])); 
  });

  socketServer.on('connection', function(client){
    logSocket.info("[WORKER %d] Client connected.", cluster.worker.id);

    client.on("message", function(msg){
      logSocket.debug("[WORKER %d] %s", cluster.worker.id, msg);
    });

    client.on("close", function(){
      logSocket.info("[WORKER %d] Client connection closed.", cluster.worker.id);
    });
  });

  // Start the HTTP server
  logHTTP.info("[WORKER %d] Starting server on port %s", cluster.worker.id, config.http.port);
  //console.log("Worker " + cluster.worker.id + " starting server on port " + config.http.port);
  server.listen(config.http.port);

};
