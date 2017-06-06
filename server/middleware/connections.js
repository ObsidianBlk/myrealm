
module.exports = function(config, r){
  var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var shortid = require('shortid');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:connections");


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


  function HandleReconnection(ctx, next){
    var rkey = r.Key("visitor", ctx.request.data.id);
    r.pub.hmget([rkey, "token", "username"]).then(function(values){
      var token = values[0];
      var username = values[1];
      ctx.response.type = ctx.request.type;
      
      if (token === ctx.request.token){
	// Check to see if the token has expired yet.
	jwt.verify(token, config.secret, function(err, decoded){
	  if (err){
	    ctx.error(err.message);
            next();
	  } else if (decoded.id !== ctx.request.data.id){
	    ctx.error("Request ID and token ID do not match.");
            next();
	  } else {
	    r.pub.expire(rkey, 15*60 /* 15 minute expiration */).then(function(res){
	      var data = {
		id: ctx.request.data.id,
		username: username
	      };
	      token = jwt.sign(data, config.secret, {expiresIn:15*60});
	      r.pub.hset(rkey, "token", token).then(function(){
		ctx.co.id = ctx.request.data.id;
		ctx.response.status = "success";
		ctx.response.data = data;
		ctx.response.token = token;
		next();
	      }).catch(function(e){
		ctx.error("Failed to generate updated token.");
		next();
	      });
	    }).catch(function(e){
	      ctx.error("Unknown error occured.");
	      next();
	    });
	  }
	});
      } else { // Client gave an invalid token!
	ctx.error("Token mismatch!");
	next();
      }
    }).catch(function(e){
      log.debug("%o", e);
      ctx.response.type = ctx.request.type;
      ctx.error("Failed to find token for id.");
      next();
    });
  }


  function HandleNewConnection(ctx, next){
    ctx.response.type = ctx.request.type;
    log.debug("Generating a new connection");
    GenerateVisitorID(10).then(function(id){
      log.debug("New Connection ID '%s'", id);
      ctx.co.id = id;
      ctx.response.status = "success";
      var data = {
	id: ctx.co.id,
	username: "USER_" + ctx.co.id
      };
      var token = jwt.sign(data, config.secret, {expiresIn:60/*15*60*/});
      r.pub.hset(r.Key("visitor", ctx.co.id), "token", token).then(function(){
        ctx.response.data = data;
        ctx.response.token = token;
        next();
      }).catch(function(e){
        ctx.error("Failed to store new token");
        next();
      });
    }).catch(function(e){
      log.debug("%o", e);
      ctx.error("Failed to generate unique ID.");
      next();
    });
  }

  
  return function(ctx, next){
    if (typeof(ctx.co) === 'undefined'){
      log.warning("Context shows client already validated.");
      next();
    } else {
      log.debug("Handling connection request!");
      if (typeof(ctx.request.token) !== 'undefined'){ // A possible reconnection
	if (typeof(ctx.request.data) !== 'undefined'){
	  HandleReconnection(ctx, next);
	} else {
	  ctx.response.type = ctx.request.type;
	  ctx.error("Request contains token, but no data.");
	  next();
	}
      } else {
	HandleNewConnection(ctx, next);
      }
    }
  };
};
