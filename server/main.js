
// -------------------------------------------------------------------------------------------
// Server.config.json Schema
// -------------------------------------------------------------------------------------------
var CONFIG_SCHEMA = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "version": {
      "type": "string"
    },
    "processes": {
      "type": "integer"
    },
    "secret": {
      "type": "string",
      "minLength": 4
    },
    "redis": {
      "type": "object",
      "properties": {
        "host": {
          "type": "string"
        },
        "port": {
          "type": "integer"
        },
	"connectionTimeout":{
	  "type": "integer"
	}
      },
      "required": [
        "host",
        "port"
      ]
    },
    "http": {
      "type": "object",
      "properties": {
        "port": {
          "type": "integer"
        },
	"path":{
	  "type": "string",
	  "minLength": 1
	}
      },
      "required": [
        "port",
	"path"
      ]
    },
    "logging": {
      "type": "object",
      "properties": {
	"minLevel": ["integer", "string"],
	"maxLevel": ["integer", "string"]
      },
      "require": [
	"minLevel",
	"maxLevel"
      ]
    },
    "plugins": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "version",
    "secret",
    "redis",
    "http"
  ]
};

var path = require('path');
var tv4 = require('tv4');

// -------------------------------------------------------------------------------------------
// Loading in the Config file (if it exists)...
// -------------------------------------------------------------------------------------------
try {
  var config = require(path.resolve('server.config.json'));
} catch (e) {
  console.error("Failed to load Server.config.json.\n\"" + e.message + "\".\nUsing default configuration.");
  config = null;
}

if (config !== null && tv4.validate(config, CONFIG_SCHEMA) === false){
  console.error("Server.config.json is invalid.\nUsing default configuration.");
  config = null;
}

if (config === null){
  config = {
    version:"1.0.0",
    processes:0,
    redis:{
      host:"localhost",
      port:6379
    },
    http:{
      port:3000
    },
    logging:{
      minLevel:"debug",
      maxLevel:"error"
    }
  };
}

if (typeof(config.redis.connectionTimeout) !== 'number'){
  config.redis.connectionTimeout = 5;
}


var cluster = require('cluster');

if (cluster.isMaster){
  var Logger = require('./logger')(config.logging);
  var log = new Logger("homegrid:master");
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
