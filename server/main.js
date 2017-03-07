
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
    "redis": {
      "type": "object",
      "properties": {
        "host": {
          "type": "string"
        },
        "port": {
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
        }
      },
      "required": [
        "port"
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
    "processes",
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
  console.warning("Failed to load Server.config.json.\n\"" + e.message + "\".\nUsing default configuration.");
  config = null;
}

if (config !== null && tv4.validate(config, CONFIG_SCHEMA) === false){
  console.warning("Server.config.json is invalid.\nUsing default configuration.");
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
    }
  };
}


var cluster = require('cluster');

if (cluster.isMaster){
  var numCPUs = require('os').cpus().length;
  //var server = require('http').createServer();
  //var socketServer = require('uws').Server;

  if (config.processes <= 0){
    config.processes = numCPUs;
  } else if (config.processes > numCPUs){
    console.warning("Number of requested processes exceed number of CPUs on system.");
  }

  cluster.on("fork", function(worker){
    console.log("Worker " + worker.id + " forked.");
  });

  cluster.on("online", function(worker){
    console.log("Worker " + worker.id + " online.");
  });

  cluster.on("listening", function(worker, addr){
    console.log("Worker " + worker.id + " listening on host '" + addr.address + "', port " + addr.port);
  });

  cluster.on("disconnect", function(worker){
    console.log("Worker " + worker.id + " has disconnected.");
  });

  cluster.on("exit", function(worker, code, signal){
    console.log("Worker " + worker.id + " exited with Signal/Code " + signal + "/" + code);
  });

  for (var i=0; i < config.processes; i++){
    cluster.fork();
  }
  
} else if(cluster.isWorker){
  require('./worker')(cluster, config);
}

/*
var path = require('path');
var express = require("express");
var app = express();

// serves main page
app.get("/", function(req, res) {
  res.sendfile(path.resolve('client/index.html'));
});

// serves all the static files
app.get(/^(.+)$/, function(req, res){ 
  console.log('static file request : ' + req.params);
  res.sendfile(path.resolve('client/' + req.params[0])); 
});

app.listen(3000, function () {
  console.log("Listening on port 3000!");
});
*/
