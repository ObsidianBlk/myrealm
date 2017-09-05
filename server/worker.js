
module.exports = function(cluster, config){
  if (cluster.isWorker !== true){
    throw new Error("Expected to be spawned as a Cluster Worker.");
  }

  // -------------------------------------------
  // -- Setting up logging
  var Logger = require('./utils/logger')(config);
  var logWorker = new Logger("worker");
  var logHTTP = new Logger("http");
  

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

  var server_running = false;

  // Loading the Plugins...
  // TODO: Break the hardcoding...
  require('./realm/ether')(mediator, r, config);
  require('./realm/visitor')(mediator, r, config);


  // Configure the View Engine to use handlebar templates.
  var hbs = require('hbs');
  app.set('view engine', 'html');
  //app.set('views', path.resolve((typeof(config.http.views) === 'string') ? config.http.views : 'views'));
  app.engine('html', hbs.__express);


  function LoadPartials(root, domain, partials){
    if (typeof(partials) === 'string'){
      var ppath = path.normalize(path.resolve(path.join(root, '_' + partials + ".html")));
      try {
	fs.accessSync(ppath, fs.constants.F_OK | fs.constants.R_OK);
      } catch (e) {
	logWorker.warning("[WORKER %d] Partial file '%s' is missing or unreadable.", cluster.worker.id, ppath);
	return;
      }
      var partial_name = ((domain !== "") ? domain + "_" : "") + partials;
      hbs.registerPartial(partial_name, fs.readFileSync(ppath, 'utf8'));
    } else if (partials instanceof Array){
      partials.forEach(function(partial){
	LoadPartials(root, domain, partial);
      });
    }
  }

  function CleanDomain(d, rep){
    if (d === "/"){
      return "";
    }

    var dom = d.replace('/[/\s]*/', rep);
    if (dom.startsWith(rep) === true){
      dom = dom.substr(1);
    }
    if (dom.endsWith(rep) === true){
      dom = dom.substr(0, dom.length-1);
    }
    return dom;
  }
  
  // Configuring server paths
  config.realms.list.forEach(function(realm){
    var www_path = realm.www_path;
    if (www_path.substr(0, 1) !== "/"){ // Assume relative path.
      www_path = path.normalize(path.resolve(path.join(__dirname, www_path)));
    } else { // Treat as an absolute path.
      www_path = path.normalize(path.resolve(www_path));
    }
    
    var views_path = realm.views_path;
    if (views_path.substring(0, 1) !== "/"){ // Assume relative path.
      views_path = path.normalize(path.resolve(path.join(www_path, views_path)));
    } else { // Treat as an absolute path.
      views_path = path.normalize(path.resolve(views_path));
    }
    
    var partials_path = (typeof(realm.partials_path) === 'string') ? realm.partials_path : "partials";
    if (partials_path.substring(0, 1) !== "/"){
      partials_path = path.normalize(path.resolve(path.join(views_path, partials_path)));
    } else {
      partials_path = path.normalize(path.resolve(partials_path));
    }

    if (typeof(realm.partials) !== 'undefined'){
      LoadPartials(partials_path, CleanDomain(realm.domain_name, "_"), realm.partials);
    }
    
    var template_file = path.join(views_path, "index");
    var context = (typeof(realm.context) !== 'undefined') ? realm.context : {};

    // Attach the bundle scripts.
    if (typeof(context.bundle_scripts) === 'undefined'){
      context.bundle_scripts = config.realms.bundle_scripts;
    }

    // Serve the primary view for this realm's domain
    var domain = CleanDomain(realm.domain_name, "/");
    app.get('/'+domain, function(req, res){
      res.render(template_file, context);
    });

    // serves all the static files for this realm's domain
    var re = new RegExp("^" + ((domain === "") ? "/" : "(/" + domain + "/)") + "(.+)$", "g");
    app.get(re, function(req, res){
      logHTTP.debug("[WORKER %d] Static file request: %o", cluster.worker.id, req.params);
      var resourcePath = path.resolve(path.join(www_path, req.params[0]));
      fs.exists(resourcePath, function(exists){
	if (exists){
	  res.sendFile(resourcePath);
	} else {
	  logHTTP.debug("[WORKER %d] Requested file does not exist, '%s'", cluster.worker.id, resourcePath);
	  res.status(404).send("Resource '" + req.params[0] + "' Not found.");
	}
      }); 
    });
  });

  // serves all the static files
  /*app.get(/^(.+)$/, function(req, res){
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
  });*/



  

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
      if (typeof(msg.type) !== 'string'){
	logWorker.error("Master sent invalid message.");
      }
      
      switch(msg.type){
      case "terminate":
	ExitWorker();
	break;
      case "prepareserver":
	if (server_running === false){
	  logWorker.debug("Been asked to prepare the server...");
	  mediator.emitter.emit("prepareserver")
	    .then(function(){
	      logWorker.debug("Prepared. Letting Main know!");
	      cluster.worker.send({type:"serverprepared", wid:cluster.worker.id});
	    });
	}
	break;
      case "startserver":
	if (server_running === false){
	  StartServer();
	}
	break;
      }
      if (msg.command === "terminate"){
	ExitWorker();
      }
    }
  });
  // ---------------------------------------------------------------
  

  function StartServer(){
    server_running = true;
    // Connects the web sockets server to the http server.
    mediator.sockets.begin(server);

    // Start the HTTP server
    logHTTP.info("[WORKER %d] Starting server on port %s", cluster.worker.id, config.port);
    server.listen(config.port);
  }

};
