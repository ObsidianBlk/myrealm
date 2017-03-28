
module.exports = function(cluster, config){
  if (cluster.isWorker !== true){
    throw new Error("Expected to be spawned as a Cluster Worker.");
  }

  // -------------------------------------------
  // -- Setting up logging
  var Logger = require('./logger')(config.logging);
  var logWorker = new Logger(config.logDomain + ":worker");
  var logHTTP = new Logger(config.logDomain + ":http");
  

  logWorker.info("Started Worker %d", cluster.worker.id);

  // -------------------------------------------
  // -- Getting basic modules
  var path = require('path');
  var moment = require('moment');

  // -------------------------------------------
  // -- Setting up Redis Pub/Sub connections...
  var r = require('./redisPubSub')(cluster.worker.id, config);

  // -------------------------------------------
  // -- Getting HTTP and Socket servers
  var app = require('express')();
  var server = require('http').createServer(app);
  var socketServer = new (require('uws').Server)({server:server});
  var Dispatch = require('./dispatch')(cluster.worker.id, config, r);

  // Configuring server paths
  app.get('/', function(req, res){
    res.sendFile(path.resolve(config.http.path + 'index.html'));
  });

  // serves all the static files
  app.get(/^(.+)$/, function(req, res){
    logHTTP.debug("[WORKER %d] Static file request: %o", cluster.worker.id, req.params);
    //console.log('static file request : ' + req.params);
    res.sendFile(path.resolve(config.http.path + req.params[0])); 
  });

  socketServer.on('connection', function(client){
    /*
    logSocket.info("[WORKER %d] Client connected.", cluster.worker.id);

    client.on("message", function(msg){
      logSocket.debug("[WORKER %d] %s", cluster.worker.id, msg);
    });

    client.on("close", function(){
      logSocket.info("[WORKER %d] Client connection closed.", cluster.worker.id);
    });
    */
    Dispatch.connection(client);
  });

  // Start the HTTP server
  logHTTP.info("[WORKER %d] Starting server on port %s", cluster.worker.id, config.http.port);
  //console.log("Worker " + cluster.worker.id + " starting server on port " + config.http.port);
  server.listen(config.http.port);

};
