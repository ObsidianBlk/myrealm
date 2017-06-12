

var version = require('./version');
var config = require("./config");
var cluster = require('cluster');

if (cluster.isMaster){
  var Logger = require('./utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":master");
  var numCPUs = require('os').cpus().length;
  var activeWorkers = 0;
  var keepWorkersAlive = true;

  version('.').then(function(ver){
    console.log("------------------------------------------");
    console.log("MyRealm Multi-User VR Web Server.");
    console.log("Version: " + ver);
    console.log("------------------------------------------");
  });

  if (config.terminal.enabled === true){
    var terminal = require('./utils/terminalsock')(
      config.terminal.host,
      config.terminal.port,
      config.terminal.maxConnections,
      config.terminal.authCode
    );
  }
  

  if (config.processes <= 0){
    config.processes = numCPUs;
  } else if (config.processes > numCPUs){
    log.warning("Number of requested processes exceed number of CPUs on system.");
  }

  cluster.on("fork", function(worker){
    log.info("Worker %d forked.", worker.id);
  });

  cluster.on("online", function(worker){
    log.info("Worker %d online", worker.id);
  });

  cluster.on("listening", function(worker, addr){
    log.info("Worker %d listening on %s:%s", worker.id, (addr.address !== null) ? addr.address : "localhost", addr.port);
  });

  cluster.on("disconnect", function(worker){
    log.info("Worker %d has disconnected.", worker.id);
  });

  // ---
  // Handling spamming of worker exits... (could be a critial failure. Don't want to continuously spam failing processes)
  var closelog = [];
  function RegisterWorkerClosure(){
    var timestamp = Date.now();
    closelog = closelog.filter(function(ts){
      return ts > timestamp - 5000;
    });
    closelog.push(timestamp);
  }

  var shutdownInterval = null;
  function HandleClose(){
    keepWorkersAlive = false;
    log.debug("Check to see if Workers closing...");
    // Been asked to quit, but wait a moment (1 second) to see if Workers given the same request...
    shutdownInterval = setTimeout(function(){
      // If we get here, then the Workers have not closed on their own.
      for(var wid in cluster.workers) {
	log.debug("Sending Worker %d the 'terminate' command.", wid);
	cluster.workers[wid].send({command:"terminate"});
      }
    }, 1000);
  }

  cluster.on("exit", function(worker, code, signal){
    log.info("Worker %d existed with Signal/Code %s/%d", worker.id, signal, code);
    activeWorkers --;
    if (keepWorkersAlive === true){
      RegisterWorkerClosure();
      if (closelog.length > 32){
	log.error("Worker closure rate extreemly high. Closing server.");
	HandleClose();
      } else {
	cluster.fork();
	activeWorkers++;
      }
    } else {
      if (activeWorkers <= 0){
	if (shutdownInterval !== null){
	  clearTimeout(shutdownInterval);
	  shutdownInterval = null;
	} 
      
	log.info("All workers closed. Terminating server.");
	process.exit(0);
      }
    }
  });


  process.on("SIGTERM", HandleClose);
  process.on("SIGINT", HandleClose);

  for (var i=0; i < config.processes; i++){
    cluster.fork();
    activeWorkers++;
  }
  
} else if(cluster.isWorker){
  require('./worker')(cluster, config);
}
