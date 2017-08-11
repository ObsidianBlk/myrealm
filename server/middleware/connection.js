module.exports = function(config, r){
  //var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var shortid = require('shortid');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:connection");

  function GenerateVisitorID(attempts){
    return new Promise(function(resolve, reject){
      var id = shortid();
      var key = r.Key("visitor", id);
      r.pub.hgetall(key, function(err, obj){
	if (err){
	  log.error(err);
	  reject(err);
	} else {
	  if (obj.length > 0){
	    if (attempts > 0){
	      resolve(GenerateVisitorID(attempts-1));
	    } else {
	      reject(new Error("Failed to obtain a unique visitor ID."));
	    }
	  } else {
	    r.pub.hmset(key, {
	      username: "VISITOR_" + id,
	      validated: false
	    }, function(err){
	      if (err){
		reject(new Error("Failed to generate hash for new visitor ID '" + id + "'. \"" + err + "\"."));
	      }
	      resolve(id);
	    });
	  }
	}
      });
    });
  }


  function HandleNewConnection(ctx){
    return new Promise(function(resolve, reject){
      log.debug("Generating a new connection");
      GenerateVisitorID(10).then(function(id){
        log.debug("New Connection ID '%s'", id);
        ctx.co.id = id;
        ctx.data.connection_new = true;
        var data = {
          // More data can be stored, but this is basic enough.
	  id: ctx.co.id,
	  username: "Visitor_" + ctx.co.id
        };
        var rkey = r.Key("visitor", id + "_data");
        resolve(r.pub.hmset(rkey, data));
      }).catch(function(e){
        log.debug("%o", e);
        ctx.error("Failed to generate unique ID.");
	resolve();
      });
    });
  }

  

  /*
    Generates connection information.
   */
  return {
    connect: function(ctx, next){
      if (ctx.errored === true){next();}
      if (typeof(ctx.co) === 'undefined'){
	log.warning("Client connection already registered.");
	ctx.error("Connection registered. Invalid request.");
	next();
      }

      log.debug("Generating ID for new connection.");
      HandleNewConnection(ctx).then(function(){next();});
    },

    reestablish: function(ctx, next){
      if (ctx.errored === true){next();}
      if (typeof(ctx.co) === 'undefined'){
	log.warning("Client attempted to reestablish an already valid connection.");
	ctx.error("Connection registered. Invalid request.");
	next();
      }
      ctx.co.id = ctx.request.data.id;
      next();
    }
  };
};
