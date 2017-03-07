
var cluster = require('cluster');

if (cluster.isMaster){
  var numForks = require('os').cpus().length;
  var server = require('http').createServer();
  var io = require('socket.io').listen(server);
  var redis = require('socket.io-redis');
  io.adapter(redis({host:'localhost', port:6379}));


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

  for (var i=0; i < numForks; i++){
    cluster.fork();
  }
  
} else if(cluster.isWorker){
  require('./worker')(cluster);
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
