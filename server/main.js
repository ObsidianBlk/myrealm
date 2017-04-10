

var config = require("./config");
var cluster = require('cluster');

if (cluster.isMaster){
  var Logger = require('./logger')(config.logging);
  var log = new Logger(config.logDomain + ":master");
  var numCPUs = require('os').cpus().length;

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

  cluster.on("exit", function(worker, code, signal){
    log.info("Worker %d existed with Signal/Code %s/%i", worker.id, signal, code);
  });

  for (var i=0; i < config.processes; i++){
    cluster.fork();
  }
  
} else if(cluster.isWorker){
  require('./worker')(cluster, config);
}
