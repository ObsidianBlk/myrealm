
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

  // "Mediates" the various communications between client/server and plugins.
  var mediator = {
    // Triggers listening events
    emitter: new (require('./mediator/aemitter'))(),
    // Call ("request") data from plugin functions (that may or may not exist).
    requester: new (require('./mediator/arequester'))()
  };
  // Direct client/server communications
  mediator.sockets = require('./mediator/sockets')(cluster.worker.id, mediator.emitter, r, config);

  // Loading the Plugins...
  // TODO: Break the hardcoding...
  require('./realm/ether')(mediator, r, config);
  require('./realm/visitor')(mediator, r, config);


  // Configure the View Engine to use handlebar templates.
  var hbs = require('hbs');
  app.set('view engine', 'html');
  app.set('views', path.resolve((typeof(config.http.views) === 'string') ? config.http.views : 'views'));
  app.engine('html', hbs.__express);


  function LoadPartials(partials, partialsPath){
    if (partials instanceof Array){
      var basePath = path.resolve((typeof(partialsPath) === 'string') ? partialsPath : 'views/partials');
      partials.forEach(function(partial){
	var ppath = path.join(basePath, '_' + partial + ".html");
	try {
	  if (fs.statSync(ppath).isFile() === false){
	    ppath = null;
	  }
	} catch (e) {
	  logWorker.debug("[WORKER %d] %s", cluster.worker.id, e.message);
	  ppath = null;
	}
	if (ppath !== null){
	  logWorker.debug("%s | %s", partial, ppath);
	  hbs.registerPartial(partial, fs.readFileSync(ppath, 'utf8'));
	} else {
	  logWorker.warning(
	    "[WORKER %d] Cannot load partial. Path '%s' is not a file.",
	    cluster.worker.id,
	    path.join(basePath, '_' + partial + ".html")
	  );
	}
      });
    }
  }
  
  // Loading template partials... if any.
  LoadPartials(config.partials);
  
  
  // Configuring server paths
  config.realms.forEach(function(realm){
    var template_file = (realm.subrealm === "") ? "index" : realm.subrealm;
    var context = null;
    try {
      context = (realm.context) ? realm.context : require(realm.context_path);
    } catch (e) {
      // TODO: Should I cancel boot?
      console.error("Failed to load Sub-Realm context '" + realm.context_path + "'");
      context = {};
    }
    // Attach the bundle scripts, if any are defined, to the context.
    if (realm.bundle_scripts){
      context.bundle_scripts = realm.bundle_scripts;
    }
    
    app.get('/'+realm.subrealm, function(req, res){
      res.render(template_file, context);
    });
  });

  // serves all the static files
  app.get(/^(.+)$/, function(req, res){
    logHTTP.debug("[WORKER %d] Static file request: %o", cluster.worker.id, req.params);
    var resourcePath = path.resolve(((typeof(config.http.www) === 'string') ? config.http.www : "")  + req.params[0]);
    fs.exists(resourcePath, function(exists){
      if (exists){
	res.sendFile(resourcePath);
      } else {
	logHTTP.debug("[WORKER %d] Requested file does not exist, '%s'", cluster.worker.id, resourcePath);
	res.status(404).send("Resource '" + req.params[0] + "' Not found.");
      }
    }); 
  });



  

  // ---------------------------------------------------------------

  var exiting = false;
  function ExitWorker(){
    if (exiting === false){
      exiting = true;
      logWorker.info("[WORKER %d] Closing client connections...", cluster.worker.id);
      server.close(function(){
	logWorker.info("[WORKER %d] Closed server.", cluster.worker.id);
	process.exit(0);
      });
    }
  }

  
  cluster.worker.on("message", function(msg){
    if (exiting === false){
      if (msg.command){
	if (msg.command === "terminate"){
	  ExitWorker();
	}
      }
    }
  });
  // ---------------------------------------------------------------
  

  // Connects the web sockets server to the http server.
  mediator.sockets.begin(server);

  // Start the HTTP server
  logHTTP.info("[WORKER %d] Starting server on port %s", cluster.worker.id, config.http.port);
  server.listen(config.http.port);

};
