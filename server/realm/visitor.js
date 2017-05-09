
module.exports = function(m, r, config){
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":visitor");
  var workerid = m.sockets.workerid;

  var mwValidation = require('../middleware/validation')(config, r);

  var NS_TELEMETRY = "visitor:telemetry";

  // [[number, number, number, number], ...]
  // [[Center_x, Center_y (foot level), Center_z, radius], ...]
  var SPAWN_ZONES = [
    [0.0, 0.0, 0.0, 30]
  ];

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

  /*function dupObjectProperties(obj, plist){
    var no = null;
    plist.forEach(function(p){
      if (obj.hasOwnProperty(p[0]) && typeof(obj[p[0]]) === p[1]){
	if (no === null){no = {};}
	no[p[0]] = obj[p[0]];
      }
    });
    return no;
  }*/


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
  

  function getTelemetry(id){
    return new Promise(function(resolve, reject){
      var kTelemetry = r.Key(NS_TELEMETRY, id);
      r.pub.ttl(kTelemetry).then(function(res){
	if (res === -1){ // No Expiration
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

  function setTelemetry(id, data){
    return new Promise(function(resolve, reject){
      var tdat = (function(){
	var o = {};
	if (typeof(data.position_x) === 'number' || typeof(data.position_x) === 'string'){
	  o.position_x = Number(data.position_x);
	}
	if (typeof(data.position_y) === 'number' || typeof(data.position_y) === 'string'){
	  o.position_y = Number(data.position_y);
	}
	if (typeof(data.position_z) === 'number' || typeof(data.position_z) === 'string'){
	  o.position_z = Number(data.position_z);
	}

	if (typeof(data.rotation_x) === 'number' || typeof(data.rotation_x) === 'string'){
	  o.rotation_x = Number(data.rotation_x);
	}
	if (typeof(data.rotation_y) === 'number' || typeof(data.rotation_y) === 'string'){
	  o.rotation_y = Number(data.rotation_y);
	}
	if (typeof(data.rotation_z) === 'number' || typeof(data.rotation_z) === 'string'){
	  o.rotation_z = Number(data.rotation_z);
	}
	
	return o;
      })();
      if (tdat !== null){
	var kTelemetry = r.Key(NS_TELEMETRY, id);
	// Check if the telemetry for the given id is set to expire.
	console.log(tdat);
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
	result.position_x += data.position_dx;
	result.position_y += data.position_dy;
	result.position_z += data.position_dz;
	setTelemetry(ctx.id, result).then(function(){
	  var resp = ctx.response;
	  result.visitor_id = ctx.id;
	  resp.type = "telemetry";
	  resp.data = result;
	  log.debug("[WORKER %d] Sending positional telemetry!", workerid);
	  ctx.broadcast(false); // Want the caller AND others to receive this.
	  // TODO: Filter "receivers" to only those in the same layers.
	});
      }).error(function(err){
	log.error("[WORKER %d] %s", workerid, err);
      });
    } else {
      log.error("[WORKER %d] %s", workerid, err);
    }
  });

  m.sockets.handler("visitor_orientation", mwValidation, function(ctx, err){
    // NOTE: This handler will take the orientation data at face value. The reason is we don't want the server to control
    // head orientation.
    if (!err){
      var data = ctx.request.data;
      setTelemetry(ctx.id, {
	rotation_x: data.rotation_x,
	rotation_y: data.rotation_y,
	rotation_z: data.rotation_z
      }).then(function(){
	var resp = ctx.response;
	resp.type = "telemetry";
	resp.data = {
	  rotation_x: data.rotation_x,
	  rotation_y: data.rotation_y,
	  rotation_z: data.rotation_z
	};
	log.debug("[WORKER %d] Sending rotational telemetry!", workerid);
	ctx.broadcast(); // Send to everyone EXCEPT the caller!
      });
    } else {
      log.error("[WORKER %d] %s", workerid, err);
    }
  });

  // ----------------------------------------------------------------------
  // Event Handlers
  // ----------------------------------------------------------------------
  m.emitter.on("client_connected", function(id){
    log.debug("[WORKER %d] Client Connection emitted!", workerid);
    getTelemetry(id).then(function(telemetry){
      if (telemetry === null){
	telemetry = RandomSpawnPosition();
	log.debug("[WORKER %d] No telemetry for '%s'. Generated new telemetry.", workerid, id);
      }
      console.log(telemetry);
      setTelemetry(id, telemetry).then(function(){
	log.info("[WORKER %d] Connected visitor '%s' positioned at (%d, %d, %d)", workerid, id, telemetry.position_x, telemetry.position_y, telemetry.position_z);
	telemetry.visitor_id = id;
	// TODO: The "telemetry" broadcast MAY not be good enough to trigger a "new visitor" in the client. Add something more concrete?
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
