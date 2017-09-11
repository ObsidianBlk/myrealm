
module.exports = function(m, r, config){
  var Promise = require('bluebird');
  var THREE = require('three');
  var Logger = require('../../utils/logger')(config);
  var log = new Logger("visitor");
  var workerid = m.sockets.workerid;

  //var mwValidation = require('../middleware/validation')(config, r);
  var mwTokenize = require('../../middleware/tokenize')(config, r);
  var mwHMAC = require('../../middleware/hmac')(config, r);
  
  var NS_TELEMETRY = "visitor:telemetry";


  // [[number, number, number, number], ...]
  // [[Center_x, Center_y (foot level), Center_z, radius], ...]
  var SPAWN_ZONES = [
    [0.0, 0.0, 0.0, 30]
  ];

  // ----------------------------------------------------------------------
  // Work Functions
  // ----------------------------------------------------------------------
  //var fUpdatePosition = m.requester.requestFunc("world.updatePosition");

  function HMGetResultTransformer(result){
    if (Array.isArray(result) === true){
      var o = {};
      for (var i=0; i < result.length; i+=2){
	o[result[i]] = result[i+1];
      }
    }
    return result;
  }


  function RandomSpawnPosition(){
    var zone = Math.floor(Math.random()*SPAWN_ZONES.length);
    var r = Math.random()*SPAWN_ZONES[zone][3];
    var angle = Math.random()*(2*Math.PI);
    return {
      position_x: SPAWN_ZONES[zone][0] + (r*Math.sin(angle)),
      position_z: SPAWN_ZONES[zone][2] + (r*Math.cos(angle)),
      position_y: SPAWN_ZONES[zone][1]
    };
  }
  

  function getTelemetry(id, persist){
    persist = (persist === true);
    return new Promise(function(resolve, reject){
      var kTelemetry = r.Key(NS_TELEMETRY, id);
      r.pub.ttl(kTelemetry).then(function(res){
	if (res === -1 || (res > 0 && persist === false)){ // No Expiration or, get the data while we can.
	  r.pub.hgetall(kTelemetry).then(function(result){
	    resolve(result);
	  }).error(function(err){reject(err);});
	} else if (res >= 0){ // There is an upcoming expiration
	  r.pub.persist(kTelemetry).then(function(){ // Clear expiration
	    r.pub.hgetall(kTelemetry).then(function(result){ // Get and return telemetry data.
	      resolve(result);
	    }).error(function(err){reject(err);});
	  });
	} else { // No key... return null.
	  resolve(null);
	}
      });
    });
  }

  function TelemetryDataBuilder(data, propList){
    var o = {};
    propList.forEach(function(prop){
      if (data.hasOwnProperty(prop) === true && (typeof(data[prop]) === 'number' || typeof(data[prop]) === 'string')){
	o[prop] = Number(data[prop]);
      }
    });
    return o;
  }

  function setTelemetry(id, data, persist){
    persist = (persist === true);
    return new Promise(function(resolve, reject){
      var tdat = TelemetryDataBuilder(data, [
	"position_x", "position_y", "position_z",
	"rotation_x", "rotation_y", "rotation_z",
	"facing_x", "facing_y", "facing_z"
      ]);
      if (tdat !== null){
	var kTelemetry = r.Key(NS_TELEMETRY, id);
	// Check if the telemetry for the given id is set to expire.
	r.pub.ttl(kTelemetry).then(function(ret){
	  if (ret === -1 || (ret >= 0 && persist === false)){ // It's not set to expire, or we don't want to stop expiration, so just set the key.
	    resolve(r.pub.hmset(kTelemetry, tdat));
	  } else { // It's going to expire, remove the expiration, then set the key...
	    r.pub.persist(kTelemetry).then(function(){
	      resolve(r.pub.hmset(kTelemetry, tdat));
	    });
	  }
	});
      } else {
	reject(new Error("No telemetry data."));
      }
    });
  }

  function clearTelemetry(id, timeout){
    var kTelemetry = r.Key(NS_TELEMETRY, id);
    if (typeof(timeout) === 'number' && timeout > 0){
      r.pub.expire(kTelemetry, timeout);
    } else {
      r.pub.del(kTelemetry);
    }
  }

  function getVisitorListAndTelemetry(){
    return new Promise(function(resolve, reject){
      r.pub.smembers(r.Key("visitor_list")).then(function(results){ // Get the list of visitors from redis.
        var promlist = [];
        // For each id...
        results.forEach(function(id, i, a){
          // ... create a promise ...
          var p = new Promise(function(res, rej){
            // ... that obtains the telemetry for each user id ...
            getTelemetry(id).then(function(t){
              // ... Alter the result array entry to conform to a message format with visitor_id and telemetry ...
              a[i] = {visitor_id:id, telemetry:t};
              res();
            }).error(function(e){rej(e);});
          });
          promlist.push(p);
        });
        // ... wait for all the promises to finish ...
        Promise.all(promlist).then(function(){
          resolve(results); // ... and send the result list to resolve the main promise.
        }).error(function(e){
          reject(e); // ... or die trying, damn-it!
        });
      });
    });
  }
  
  // ----------------------------------------------------------------------
  // Direct Socket Client Request!
  // ----------------------------------------------------------------------
  m.sockets.handler(
    "visitor_move",
    mwTokenize.getToken,
    mwHMAC.verifyHMAC,
    function(ctx, next){
      getTelemetry(ctx.id).then(function(result){
	var data = TelemetryDataBuilder(ctx.request.data, [
	  "position_dx", "position_dy", "position_dz"
	]);
	if (data.hasOwnProperty("position_dx") === false ||
	    data.hasOwnProperty("position_dy") === false ||
	    data.hasOwnProperty("position_dz") === false){
	  ctx.error("Some or all positional deltas missing.");
	  next();
	} else {
	  // TODO: Need to validate telemetry against a world tester... or, at least, make an attempt to?
	  result.position_x = ((result.position_x !== null) ? Number(result.position_x) : 0) +  data.position_dx;
	  result.position_y = ((result.position_y !== null) ? Number(result.position_y) : 0) +  data.position_dy;
	  result.position_z = ((result.position_z !== null) ? Number(result.position_z) : 0) +  data.position_dz;
	  setTelemetry(ctx.id, result).then(function(){
	    var resp = ctx.response;
	    result.visitor_id = ctx.id;
	    resp.type = "telemetry";
	    resp.data = result;
	    next();
	  });
	}
      }).error(function(err){
	log.error("[WORKER %d] %s", workerid, err);
	ctx.error("Unknown server error occured.");
      });
    },
    function(ctx, err){
      if (ctx.errored === true){
	ctx.send();
      } else {
	ctx.broadcast();
	// TODO: Filter "receivers" to only those in the same layers.
      }
    }
  );

  m.sockets.handler(
    "visitor_orientation",
    mwTokenize.getToken,
    mwHMAC.verifyHMAC,
    function(ctx, next){
      // NOTE: This handler will take the orientation data at face value. The reason is we don't want the server to control
      // head orientation.
      var data = TelemetryDataBuilder(ctx.request.data, [
	"rotation_x", "rotation_y", "rotation_z",
	"facing_x", "facing_y", "facing_z"
      ]);
      setTelemetry(ctx.id, data).then(function(){
	var resp = ctx.response;
	resp.type = "telemetry";
	data.visitor_id = ctx.id;
	resp.data = data;
	next();
      }).error(function(err){
	log.error("[WORKER %d] %s", workerid, err);
	ctx.error("Server error has occured.");
	next();
      });
    },
    function(ctx, err){
      if (ctx.errored === true){
	ctx.send();
      } else {
	ctx.broadcast([ctx.id], true); // Send to everyone EXCEPT the caller!
      }
    }
  );

  // List and Telemetry of existing visitors!
  m.sockets.handler(
    "visitor_list",
    mwTokenize.getToken,
    mwHMAC.verifyHMAC,
    function(ctx, err){
      if (!err){
	getVisitorListAndTelemetry().then(function(result){
          ctx.response.data = result.filter(function(i){return i.visitor_id !== ctx.id;});
	  ctx.response.type = ctx.request.type;
	  ctx.send();
	});
      } else {
	log.error("[WORKER %d] %s", workerid, err);
      }
    }
  );
  
  // ----------------------------------------------------------------------
  // Event Handlers
  // ----------------------------------------------------------------------
  m.emitter.on("client_connected", function(id){
    log.debug("[WORKER %d] Client Connection emitted!", workerid);
    var EmitNewConnection = function(telemetry){
      // Store this new id into the visitor list.
      r.pub.sadd(r.Key("visitor_list"), id).then(function(){
	telemetry.visitor_id = id;
	// First, send the client their new telemetry...
	m.sockets.send(id, {
	  type: "telemetry",
	  data: { // clients only utilize position... no need to send the rest.
	    visitor_id: id,
	    position_x: telemetry.position_x,
	    position_y: telemetry.position_y,
	    position_z: telemetry.position_z
	  }
	}, {genhmac:true});
	
	// Now... let everyone ELSE know there's a new visitor!
	m.sockets.broadcast({
	  type: "visitor_enter",
	  data: {
	    visitor_id:id,
	    telemetry:telemetry
	  }
	}, [id], true);
      });
    };
    
    getTelemetry(id, true).then(function(telemetry){ // Pass true to persist the data if it's set to expire.
      if (telemetry === null){ // No preexisting telemetry...
	telemetry = RandomSpawnPosition(); // Get random position...
	log.debug("[WORKER %d] No telemetry for '%s'. Generated new telemetry.", workerid, id);
	setTelemetry(id, telemetry).then(function(){ // Store position into telemetry store for id...
	  log.info("[WORKER %d] Connected visitor '%s' positioned at (%d, %d, %d)", workerid, id, telemetry.position_x, telemetry.position_y, telemetry.position_z);
	  EmitNewConnection(telemetry); // Send message that new visitor is here!
	});
      } else { // This id had existing telemetry. No need to restore it so...
	EmitNewConnection(telemetry); // Send message that "new" visitor is here!
      }
    });
  });


  m.emitter.on("client_disconnected", function(id){
    r.pub.srem(r.Key("visitor_list"), id);
    clearTelemetry(id, 300); // Removing telemetry in 300 seconds (5 minutes).
    m.sockets.broadcast({
      type: "visitor_exit",
      data: {
	visitor_id: id
      }
    });
  });

  // ----------------------------------------------------------------------
  // Request Handlers
  // ----------------------------------------------------------------------
};
