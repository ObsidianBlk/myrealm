
module.exports = function(m, r, config){
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":visitor");
  var workerid = m.sockets.workerid;

  var mwValidation = require('../middleware/validation')(config, r);

  var NS_TELEMETRY = "visitor:telemetry";

  // [[number, number, number, number], ...]
  // [[Center_x, Center_y (foot level), Center_z, radius], ...]
  var SPAWN_ZONES = {
    [0.0, 0.0, 0.0, 30]
  };

  // ----------------------------------------------------------------------
  // Work Functions
  // ----------------------------------------------------------------------
  var fUpdatePosition = m.requester.requestFunc("world.updatePosition");

  function HMGetResultTransformer(result){
    if (Array.isArray(result) === true){
      var o = {};
      for (var i=0; i < result.length; i+=2){
	o[result[i]] = result[i+1];
      }
    }
    return result;
  }

  function dupObjectProperties(obj, plist){
    var no = null;
    plist.forEach(function(p){
      if (obj.hasOwnProperty(p[0]) && typeof(obj[p[0]]) === p[1]){
	if (no === null){no = {};}
	no[p[0]] = obj[p[0]];
      }
    });
    return no;
  }


  function RandomSpawnPosition(){
    var zone = Math.floor((Math.random()*SPAWN_ZONES.length)+0.5);
    var r = Math.random()*SPAWN_ZONES[zone][3];
    var angle = Math.random()*(2*Math.PI);
    return {
      position_x: SPAWN_ZONES[zone][0] + (r*Math.sin(angle)),
      position_z: SPAWN_ZONES[zone][2] + (r*Math.cos(angle)),
      position_y: SPAWN_ZONES[zone][1]
    };
  }
  

  function getTelemetry(id){
    return new Promise(function(resolve, reject){
      var kTelemetry = r.Key(NS_TELEMETRY, id);
      r.pub.ttl(kTelemetry).then(function(res){
	if (res === -1){ // No Expiration
	  r.pub.hmgetall(kTelemetry).then(function(result){
	    resolve(result);
	  }).error(function(err){reject(err);});
	} else if (res >= 0){ // There is an upcoming expiration
	  r.pub.persist(kTelemetry).then(function(){ // Clear expiration
	    r.pub.hmgetall(kTelemetry).then(function(result){ // Get and return telemetry data.
	      resolve(result);
	    }).error(function(err){reject(err);});
	  });
	} else { // No key... return null.
	  resolve(null);
	}
      });
    });
  }

  function setTelemetry(id, data){
    return new Promise(function(resolve, reject){
      var tdat = dupObjectProperties(data, [
	["position_x", "number"],
	["position_y", "number"],
	["position_z", "number"]
	/* TODO: Handle angle properties as well! */
      ]);
      if (tdat !== null){
	var kTelemetry = r.Key(NS_TELEMETRY, id);
	// Check if the telemetry for the given id is set to expire.
	r.pub.ttl(kTelemetry).then(function(ret){
	  if (ret === -1){ // If it's going to expire, remove the expiration, then set the key...
	    r.pub.persist(kTelemetry).then(function(){
	      resolve(r.pub.hmset(kTelemetry, tdat));
	    });
	  } else { // Otherwise just set the key.
	    resolve(r.pub.hmset(kTelemetry, tdat));
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
  
  // ----------------------------------------------------------------------
  // Direct Socket Client Request!
  // ----------------------------------------------------------------------
  m.sockets.handler("visitor_move", mwValidation, function(ctx, err){
    if (!err){
      getTelemetry(ctx.id).then(function(result){
	var data = ctx.request.data;
	// TODO: Need validation tests on data!!!
	// TODO: Need to validate telemetry against a world tester... or, at least, make an attempt to?
	result.position_x += data.dpos_x;
	result.position_y += data.dpos_y;
	result.position_z += data.dpos_z;
	result.visitor_id = ctx.id;
	setTelemetry(ctx.id, result).then(function(){
	  var resp = ctx.response;
	  resp.type = "telemetry";
	  resp.data = result;
	  ctx.broadcast(); // Want the caller AND others to receive this.
	  // TODO: Filter "receivers" to only those in the same layers.
	});
      }).error(function(err){
	log.error("[WORKER %d] %s", workerid, err);
      });
    } else {
      log.error("[WORKER %d] %s", workerid, err);
    }
  });

  // ----------------------------------------------------------------------
  // Event Handlers
  // ----------------------------------------------------------------------
  m.emitter.on("client_connected", function(id){
    getTelemetry(id).then(function(telemetry){
      if (telemetry === null){
	telemetry = RandomSpawnPosition();
      }
      
      setTelemetry(id, telemetry).then(function(){
	log.info("[WORKER %d] Connected visitor '%s' positioned at (%d, %d, %d)", workerid, id, telemetry.position_x, telemetry.position_y, telemetry.position_z);
	telemetry.visitor_id = id;
	m.sockets.broadcast({ // TODO: Filter "receivers" to only those in the same layers.
	  type: "telemetry",
	  data: telemetry
	});
      });
    });
  });


  m.emitter.on("client_disconnected", function(id){
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
