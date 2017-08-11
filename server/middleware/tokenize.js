module.exports = function(config, r){
  var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:tokenize");

  var tokenExpirationTime = (config.tokenExpiration) ? config.tokenExpiration : 900; // Default is 900 seconds (15 minutes)

  
  function GetToken(id){
    var rkey = r.Key("visitor", id + "_token");
    return r.pub.get(rkey);
  }

  function GenerateToken(id){
    return new Promise(function(resolve, reject){
      var rkey_data = r.Key("visitor", id + "_data");
      // Get the user's current data.
      r.pub.hgetall(rkey_data).then(function(data){
        resolve({token: jwt.sign(data, id + config.secret, {expiresIn:tokenExpirationTime}), vdata:data});
      }).error(function(err){
	reject(err);
      });
    });
  }

  function StoreToken(id, token){
    return new Promise(function(resolve, reject){
      var rkey_token = r.Key("visitor", id + "_token");
      var rkey_data = r.Key("visitor", id + "_data");
      r.pub.multi()
	.set(rkey_token, token)
	.expire(rkey_data, "24h")  // Resetting the expiration for both the user's data
	.expire(rkey_token, "24h") // and their token.
	.exec(function(err, results){
          if (err){
            reject(err);
          }
          resolve();
	});
    });
  }

  function ValidateToken(id, token){
    new Promise(function(resolve, reject){
      jwt.verify(token, id + config.secret, function(err, decoded){
	if (err){
	  reject(err);
	}
	resolve({token:token, vdata:decoded});
      });
    });
  }


  return {
    /*
      Create a new token using the current visitors stored data. The newly generated token will be stored in
      'ctx.response.data.token' field.
     */
    generateToken: function(ctx, next){
      if (ctx.errored === true){next();}
      var newgen = typeof(ctx.co) !== 'undefined';
      var id = (newgen === true) ? ctx.co.id : ctx.id;
      var info = null;
      GenerateToken(id).then(function(i){
	info = i;
	return StoreToken(id, info.token);
      }).then(function(){
	if (info === null){
	  throw new Error("Token generation failed. Unknown error.");
	}
	if (newgen === true){
	  ctx.response.data.vdata = info.vdata;
	  ctx.response.data.token = info.token;
	}
	next();
      });
    },


    /*
      Obtains the current token for the connection, decodes it (to validate it hasn't yet expired), and stores the token and it's decoded
      data in the 'ctx.data.token' and 'ctx.data.vdata' fields respectively, to be used by further middleware (ex, hmac validation).
     */
    getToken: function(ctx, next){
      if (ctx.errored === true){next();}
      GetToken(ctx.id).then(function(token){
	return ValidateToken(ctx.id, token);
      }).then(function(info){
	ctx.data.token = info.token;
	ctx.data.vdata = info.vdata;
	next();
      }).error(function(err){
	if (err.name === "TokenExpiredError"){
	  ctx.error("Token has expired.");
	} else {
	  log.debug(err.message);
	  ctx.error("Unknown error has occured.");
	}
	next();
      });
    },

    /*
      Special case of the getToken() middleware. This version will ONLY operate for "reestablish" requests made by unverified connections,
      in which the request must contain a 'data.id' parameter.

      NOTE: This middleware should not be used outside of the "reestablish" request middleware.
     */
    getTokenX: function(ctx, next){
      if (ctx.errored === true){next();}
      if (ctx.request.type !== 'reestablish'){
	throw new Error("Middleware function used on invalid request name.");
      }
      if (typeof(ctx.request.data.id) !== 'string'){
	ctx.error("Request invalid.");
	next();
      }

      var id = ctx.request.data.id;
      GetToken(id).then(function(token){
	return ValidateToken(id, token);
      }).then(function(info){
	ctx.data.token = info.token;
	ctx.data.vdata = info.vdata;
	next();
      }).error(function(err){
	if (err.name === "TokenExpiredError"){
	  ctx.error("Token has expired.");
	} else {
	  log.debug(err.message);
	  ctx.error("Unknown error has occured.");
	}
	next();
      });
    }
  };
};
