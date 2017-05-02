
module.exports = function(m, r, config){
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":visitor");
  var workerid = m.sockets.workerid;

  var mwValidation = require('../middleware/validation')(config, r);

  var NS_TELEMETRY = "visitor:telemetry";

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
  

  function getTelemetry(id){
    return new Promise(function(resolve, reject){
      var kTelemetry = r.Key(NS_TELEMETRY, id);
      r.pub.hmget(kTelemetry).then(function(result){
	var res = HMGetResultTransformer(result[0][1]);
	resolve(res);
      }).error(function(err){reject(err);});
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
	resolve(r.pub.hmset(kTelemetry, tdat));
      } else {
	reject(new Error("No telemetry data."));
      }
    });
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
	setTelemetry(ctx.id, result).then(function(){
	  var resp = ctx.response;
	  resp.type = "telemetry";
	  resp.data = result;
	  ctx.send();
	});
      });
      // --------
      fUpdatePosition(ctx.request.data).then(function(result){
	if (typeof(result) !== 'undefined'){
	  var resp = ctx.response;
	  resp.type = "update_position";
	  resp.data = {
	    position: result.position
	  };
	  ctx.send();
	}
	// NOTE: Nothing gets sent back to the client if no result was obtained.
      }).error(function(err){
	ctx.error(err.message);
	ctx.send();
      });
    } else {
      log.error("[WORKER %d] %s", workerid, err);
    }
  });

  // ----------------------------------------------------------------------
  // Event Handlers
  // ----------------------------------------------------------------------


  // ----------------------------------------------------------------------
  // Request Handlers
  // ----------------------------------------------------------------------
};
