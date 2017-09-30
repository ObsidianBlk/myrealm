
module.exports = function(m, r, config){
  var Promise = require('bluebird');
  var THREE = require('three');
  var Logger = require('../../utils/logger')(config);
  var log = new Logger("visitor");
  var workerid = m.sockets.workerid;

  //var mwValidation = require('../middleware/validation')(config, r);
  var mwTokenize = require('../../middleware/tokenize')(config, r);
  var mwHMAC = require('../../middleware/hmac')(config, r);
  
  var KEY_TPOSITION = "visitor:tposition";
  var KEY_TROTATION = "visitor:trotation";
  var KEY_TFACING = "visitor:tfacing";


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
      position:{
	x: SPAWN_ZONES[zone][0] + (r*Math.sin(angle)),
	z: SPAWN_ZONES[zone][2] + (r*Math.cos(angle)),
	y: SPAWN_ZONES[zone][1]
      }
    };
  }


  function hasTelemetry(o){
    return (typeof(o) === typeof({}) && o.hasOwnProperty("x") && o.hasOwnProperty("y") && o.hasOwnProperty("z"));
  }

  function cleanTelemetry(t){
    return {
      x: Number(t.x),
      y: Number(t.y),
      z: Number(t.z)
    };
  }
  

  function getTelemetry(id, telem_name){
    telem_name = (typeof(telem_name) === 'string') ? telem_name : null;
    return new Promise(function(resolve, reject){
      var m = r.pub.multi();
      if (telem_name === null){
	m.hgetall(r.Key(KEY_TPOSITION, id));
	m.hgetall(r.Key(KEY_TFACING, id));
	m.hgetall(r.Key(KEY_TROTATION, id));
      } else {
	switch (telem_name){
	case "position":
	  m.hgetall(r.Key(KEY_TPOSITION, id));
	  break;
	case "rotation":
	  m.hgetall(r.Key(KEY_TROTATION, id));
	  break;
	case "facing":
	  m.hgetall(r.Key(KEY_TFACING, id));
	  break;
	}
      }
      m.exec().then(function(res){
	var otype = typeof({});
	var telem = {};
	if (telem_name === null){
	  if (hasTelemetry(res[0][1]) === true){
	    telem.position = cleanTelemetry(res[0][1]);
	  }
	  if (hasTelemetry(res[1][1]) === true){
	    telem.facing = cleanTelemetry(res[1][1]);
	  }
	  if (hasTelemetry(res[2][1]) === true){
	    telem.rotation = cleanTelemetry(res[2][1]);
	  }
	  if (telem.hasOwnProperty("position") === false &&
	      telem.hasOwnProperty("rotation") === false &&
	      telem.hasOwnProperty("facing") === false){
	    telem = null;
	  }
	} else {
	  if (hasTelemetry(res[0][1]) === true){
	    telem[telem_name] = cleanTelemetry(res[0][1]);
	  } else {
	    telem = null;
	  }
	}
	resolve(telem);
      });
    });
    /*return new Promise(function(resolve, reject){
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
    });*/
  }

  /*
  function TelemetryDataBuilder(data, propList){
    var o = {};
    propList.forEach(function(prop){
      if (data.hasOwnProperty(prop) === true && (typeof(data[prop]) === 'number' || typeof(data[prop]) === 'string')){
	o[prop] = Number(data[prop]);
      }
    });
    return o;
  }
  */

  function isOneOfType(){
    if (arguments.length > 0){
      var t = typeof(arguments[0]);
      for (var i=1; i < arguments.length; i++){
	if (t === arguments[i]){return true;}
      }
    }
    return false;
  }

  function ExtractTelemFromProp(p, _in, _out){
    if (_in.hasOwnProperty(p) === true){
      log.debug("ETFP - %o - HAS PROPERTY!", _in);
      if (isOneOfType(_in[p].x, "number", "string") === true &&
	  isOneOfType(_in[p].y, "number", "string") === true &&
	  isOneOfType(_in[p].z, "number", "string") === true){
        log.debug("ETFP - HAS XYZ!");
	if (_out.hasOwnProperty(p) === false){
	  _out[p] = {};
	}
	_out[p].x = Number(_in[p].x);
	_out[p].y = Number(_in[p].y);
	_out[p].z = Number(_in[p].z);
      }
    }
  }

  function TelemetryDataBuilder(data){
    var o = {};
    ExtractTelemFromProp("position", data, o);
    ExtractTelemFromProp("rotation", data, o);
    ExtractTelemFromProp("facing", data, o);
    return (o.hasOwnProperty("position") || o.hasOwnProperty("rotation") || o.hasOwnProperty("facing")) ? o : null;
  }

  function setSubTelemetry(id, telem_name, data){
    return new Promise(function(resolve, reject){
      var tdat = TelemetryDataBuilder(data, telem_name);
      if (tdat !== null){
	switch(telem_name){
	case "position":
	  return r.pub.hmset(r.Key(KEY_TPOSITION, id), tdat.position);
	  break;

	case "rotation":
	  return r.pub.hmset(r.Key(KEY_TROTATION, id), tdat.rotation);
	  break;

	case "facing":
	  return r.pub.hmset(r.Key(KEY_TFACING, id), tdat.facing);
	  break;
	}
      }
      return Promise.resolve();
    });
  }

  function setTelemetry(id, data, persist){
    return new Promise(function(resolve, reject){
      var tdat = TelemetryDataBuilder(data);
      if (tdat !== null){
	var m = r.pub.multi();
	if (tdat.hasOwnProperty("position") === true){
	  m.hmset(r.Key(KEY_TPOSITION, id), tdat.position);
	}
	if (tdat.hasOwnProperty("rotation") === true){
	  m.hmset(r.Key(KEY_TROTATION, id), tdat.rotation);
	}
	if (tdat.hasOwnProperty("facing") === true){
	  m.hmset(r.Key(KEY_TFACING, id), tdat.facing);
	}
	resolve(m.exec());
      } else {
	reject(new Error("No telemetry data."));
      }
    });
    /*return new Promise(function(resolve, reject){
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
    });*/
  }

  function persistTelemetry(id){
    return r.pub.multi()
      .persist(r.Key(KEY_TPOSITION, id))
      .persist(r.Key(KEY_TROTATION, id))
      .persist(r.Key(KEY_TFACING, id))
      .exec();
  }

  function clearTelemetry(id, timeout){
    if (typeof(timeout) === 'number' && timeout > 0){
      r.pub.multi()
	.expire(r.Key(KEY_TPOSITION, id), timeout)
	.expire(r.Key(KEY_TROTATION, id), timeout)
	.expire(r.Key(KEY_TFACING, id), timeout)
	.exec();
    } else {
      r.pub.multi()
	.del(r.Key(KEY_TPOSITION, id))
	.del(r.Key(KEY_TROTATION, id))
	.del(r.Key(KEY_TFACING, id))
	.exec();
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


  // TODO: Need to refactor code below to the changes above... YAY!
  
  // ----------------------------------------------------------------------
  // Direct Socket Client Request!
  // ----------------------------------------------------------------------
  m.sockets.handler(
    "visitor_move",
    mwTokenize.getToken,
    mwHMAC.verifyHMAC,
    function(ctx, next){
      getTelemetry(ctx.id, "position").then(function(result){
	if (result !== null){
          var data = {};
          log.debug("%o | %o", result, ctx.request.data);
	  ExtractTelemFromProp('dposition', ctx.request.data, data);
          log.debug("TELEM: %o", data);
	  if (data.hasOwnProperty('dposition') === false){
            log.debug("PING BAD!!");
	    ctx.error("Some or all positional deltas missing.");
	    next();
	  } else {
            log.debug("PING GOOD!!!");
	    // TODO: Need to validate telemetry against a world tester... or, at least, make an attempt to?
	    result.position.x += data.dposition.x;
	    result.position.y += data.dposition.y;
	    result.position.z += data.dposition.z;
	    setTelemetry(ctx.id, result).then(function(){
	      var resp = ctx.response;
	      //result.visitor_id = ctx.id;
	      resp.type = "telemetry";
	      resp.data = {
                visitor_id: ctx.id,
                telemetry: result
              };
	      next();
	    });
	  }
	} else {
          log.debug("FAILED MOVE: %o", ctx.request);
	  next(); // Nothing to do. Just finish.
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
        log.debug("BROADCASTING MOVE!");
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
      var data = TelemetryDataBuilder(ctx.request.data);
      if (data !== null){
	setTelemetry(ctx.id, data).then(function(){
	  var resp = ctx.response;
	  resp.type = "telemetry";
	  //data.visitor_id = ctx.id;
	  resp.data = {
            visitor_id: ctx.id,
            telemetry: data
          };
	  next();
	}).error(function(err){
	  log.error("[WORKER %d] %s", workerid, err);
	  ctx.error("Server error has occured.");
	  next();
	});
      } else {
	next();
      }
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
	// First, send the client their new telemetry...
	m.sockets.send(id, {
	  type: "telemetry",
	  data: { // clients only utilize position... no need to send the rest.
	    visitor_id: id,
	    telemetry: {
              position: telemetry.position
            }
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

    persistTelemetry(id) // Call to remove any expiration from clients telemetry. If none exist, no harm done.
      .then(function(){
	return getTelemetry(id); // Now get the telemetry!
      })
      .then(function(telemetry){
	if (telemetry === null){ // No preexisting telemetry...
	  telemetry = RandomSpawnPosition(); // Get random position...
	  log.debug("[WORKER %d] No telemetry for '%s'. Generated new telemetry.", workerid, id);
	  setTelemetry(id, telemetry).then(function(){ // Store position into telemetry store for id...
	    log.info("[WORKER %d] Connected visitor '%s' positioned at %o", workerid, id, telemetry);
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
