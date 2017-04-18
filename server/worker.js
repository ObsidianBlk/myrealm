
module.exports = function(cluster, config){
  if (cluster.isWorker !== true){
    throw new Error("Expected to be spawned as a Cluster Worker.");
  }

  // -------------------------------------------
  // -- Setting up logging
  var Logger = require('./utils/logger')(config.logging);
  var logWorker = new Logger(config.logDomain + ":worker");
  var logHTTP = new Logger(config.logDomain + ":http");
  

  logWorker.info("Started Worker %d", cluster.worker.id);

  // -------------------------------------------
  // -- Getting basic modules
  var fs = require('fs');
  var path = require('path');
  var moment = require('moment');

  // -------------------------------------------
  // -- Setting up Redis Pub/Sub connections...
  var r = require('./utils/redisPubSub')(cluster.worker.id, config);

  // -------------------------------------------
  // -- Getting HTTP and Socket servers
  var app = require('express')();
  var server = require('http').createServer(app);
  var socketServer = new (require('uws').Server)({server:server});
  var Dispatch = require('./sockets/dispatch')(cluster.worker.id, config, r);
  var Ether = require('./realm/ether')(Dispatch, config, r);

  app.set('view engine', 'html');
  app.engine('html', require('hbs').__express);
  
  // Configuring server paths
  app.get('/', function(req, res){
    res.render("index", config.site);
    //res.sendFile(path.resolve(config.http.path + 'index.html'));
  });

  // serves all the static files
  app.get(/^(.+)$/, function(req, res){
    logHTTP.debug("[WORKER %d] Static file request: %o", cluster.worker.id, req.params);
    var resourcePath = path.resolve(config.http.path + req.params[0]);
    fs.exists(resourcePath, function(exists){
      if (exists){
	res.sendFile(resourcePath);
      } else {
	logHTTP.debug("[WORKER %d] Requested file does not exist, '%s'", cluster.worker.id, resourcePath);
	res.status(404).send("Resource '" + req.params[0] + "' Not found.");
      }
    }); 
  });

  socketServer.on('connection', function(client){
    Dispatch.connection(client);
  });

  // Start the HTTP server
  logHTTP.info("[WORKER %d] Starting server on port %s", cluster.worker.id, config.http.port);
  server.listen(config.http.port);

};
