
/*
  A simple module to compartmentalize redis pub/sub connections. 
*/
module.exports = function(workerid, config){
  var Promise = require('bluebird');
  var moment = require('moment');
  var Logger = require('./logger')(config);
  var log = new Logger("redis");
  
  var r = {};
  var SUB_Ready = false;
  var SUB_Reconnection_Time = null;

  var PUB_Ready = false;
  var PUB_Reconnection_Time = null;

  var readyTimeout = 0; // Number of seconds... If set to zero (default) there is no timeout!
  var readyCheckInterval = 100; // Number in milliseconds.

  Object.defineProperties(r, {
    "ready":{
      get:function(){return (SUB_Ready === true && PUB_Ready === true);}
    },

    "reconnecting":{
      get:function(){return !(SUB_Reconnection_Time !== null && PUB_Reconnection_Time !== null);}
    },

    "ready_sub":{
      get:function(){return SUB_Ready;}
    },

    "reconnecting_sub":{
      get:function(){return SUB_Reconnection_Time !== null;}
    },

    "ready_pub":{
      get:function(){return PUB_Ready;}
    },

    "reconnecting_pub":{
      get:function(){return PUB_Reconnection_Time !== null;}
    }
  });

  // Returns a promise that will wait for both PUB and SUB connections to be ready.
  // The promise will "time out" after 5 minutes with a value of false.
  r.onReady = function(){
    var started = moment();
    return new Promise(function(resolve, reject){
      var Check = function(){
	if (SUB_Ready === true && PUB_Ready === true){
	  resolve(true);
	} else {
	  var d = moment().diff(started);
	  if (readyTimeout <= 0 || d < readyTimeout*1000){
	    setTimeout(Check, readyCheckInterval);
	  } else {
	    resolve(false);
	  }
	}
      };

      Check();
    });
  };

  // Helper function for redis key generation.
  r.Key = function(){
    return config.redis.serverkey + ":" + Array.prototype.slice.call(arguments).join(':');
  };


  r.Redis = require('ioredis');

  /* ---------------------------------------------------------------------------------------
     Creating and Configuring SUBCRIBE connection
     --------------------------------------------------------------------------------------- */
  r.sub = new r.Redis({
    host: config.redis.host,
    port: config.redis.port
  });

  r.sub.on("ready", function(){
    SUB_Ready = true;
    log.info("[WORKER %d] Redis ::SUB:: Ready.", workerid);
  });
  r.sub.on("connect", function(){
    SUB_Reconnection_Time = null;
    log.info("[WORKER %d] Redis ::SUB:: Connection Established.", workerid);
  });
  r.sub.on("reconnecting", function(){
    SUB_Ready = false;
    if (SUB_Reconnection_Time === null){
      SUB_Reconnection_Time = moment();
      log.warning("[WORKER %d] Redis ::SUB:: Reconnecting...", workerid);
    } else {
      var now = moment();
      var d = now.diff(SUB_Reconnection_Time);
      if (d >= config.connectionTimeout*1000){
	SUB_Reconnection_Time = null;
	log.warning("[WORKER %d] Redis ::SUB:: Timed Out, trying again...", workerid);
      }
    }
  });
  r.sub.on("end", function(){
    SUB_Ready = false;
    log.info("[WORKER %d] Redis ::SUB:: Ended Connection.", workerid);
  });
  r.sub.on("error", function(err){
    if (err.code !== "ECONNREFUSED"){
      log.warning("[WORKER %d] Redis ::SUB:: Error <%s>:  \"%s\"", workerid, err.code, err.message);
    }
  });


  /* ---------------------------------------------------------------------------------------
     Creating and Configuring PUBLISH connection
     --------------------------------------------------------------------------------------- */
  r.pub = new r.Redis({
    host: config.redis.host,
    port: config.redis.port
  });

  r.pub.on("ready", function(){
    PUB_Ready = true;
    log.info("[WORKER %d] Redis ::PUB:: Ready.", workerid);
  });
  r.pub.on("connect", function(){
    PUB_Reconnection_Time = null;
    log.info("[WORKER %d] Redis ::PUB:: Connection Established.", workerid);
  });
  r.pub.on("reconnecting", function(){
    PUB_Ready = false;
    if (PUB_Reconnection_Time === null){
      PUB_Reconnection_Time = moment();
      log.warning("[WORKER %d] Redis ::PUB:: Reconnecting...", workerid);
    } else {
      var now = moment();
      var d = now.diff(PUB_Reconnection_Time);
      if (d >= config.connectionTimeout*1000){
	PUB_Reconnection_Time = null;
	log.warning("[WORKER %d] Redis ::PUB:: Timed Out, trying again...", workerid);
      }
    }
  });
  r.pub.on("end", function(){
    PUB_Ready = false;
    log.info("[WORKER %d] Redis ::PUB:: Ended Connection.", workerid);
  });
  r.pub.on("error", function(err){
    if (err.code !== "ECONNREFUSED"){
      log.warning("[WORKER %d] Redis ::PUB:: Error <%s>:  \"%s\"", workerid, err.code, err.message);
    }
  });




  
  return r;
};
