module.exports = function(config, r){
  var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:tokenize");

  var tokenExpirationTime = (config.tokenExpiration) ? config.tokenExpiration : 900; // Default is 900 seconds (15 minutes)

  /*
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
	    r.pub.expire(rkey, tokenExpirationTime).then(function(res){
	      var data = {
		id: ctx.request.data.id,
		username: username
	      };
	      token = jwt.sign(data, config.secret, {expiresIn:tokenExpirationTime});
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
    */

  
  function GetToken(id){
    var rkey = r.Key("visitor", id + "_token");
    return r.pub.get(rkey);
  }

  function GenerateToken(ctx){
    return new Promise(function(resolve, reject){
      var rkey_data = r.Key("visitor", ctx.request.data.id + "_data");
      // Get the user's current data.
      r.pub.hgetall(rkey_data).then(function(data){
        var token = jwt.sign(data, config.secret, {expiresIn:tokenExpirationTime});
        var rkey_token = r.Key("visitor", ctx.request.data.id + "_token");
        r.pub.multi()
          .set(rkey_token, token)
          .expire(rkey_data, "24h")  // Resetting the expiration for both the user's data
          .expire(rkey_token, "24h") // and their token.
          .exec(function(err, results){
            if (err){
              ctx.error(err.message);
            } else {
              ctx.response.data = data;
              ctx.response.token = token;
              ctx.data.token = token;
              ctx.data.request_validated = true; // This is a cheat, but we've validated the request using token matching instead of hmac check.
                // NOTE: Perhaps change this in the future?
            }
            resolve();
          });
      });
    });
  }

  function UpdateTokenExpiration(ctx, token){
    return new Promise(function(resolve, reject){
      // Check if token expired...
      jwt.verify(token, config.secret, function(err, decoded){
        if (!err){
          // No error, so we just update the token as requested.
          resolve(GenerateToken(ctx));
        } else if (err.name === "TokenExpiredError"){
          ctx.error("Token has expired.");
          resolve();
        }
      });
    });
  }

  /*
   */
  return function(ctx, next){
    if (ctx.request.type === "connection"){
      // The connection request is for revalidization (and token update).
      if (typeof(ctx.request.token) === 'string' && typeof(ctx.request.data) !== 'undefined'){
        GetToken(ctx.request.id).then(function(val){
          var token = val[0];
          // Validate that the token stored in redis is the same as the token given to us.
          if (token !== ctx.request.token){
            // Oh... what a shame.
            ctx.error("Token mismatch!");
            return Promise.resolve();
          }
          // Ok, the tokens match, let's generate a new token with an updated expiration!
          return UpdateTokenExpiration(ctx, token);
        }).then(function(){
          next();
        });
        // DONE

      // The connection is for a new connection which requires a new token.
      } else if (typeof(ctx.request.token) === 'undefined'){
        GenerateToken(ctx).then(function(){
          next();
        });
        // DONE
      }
      
    } else {
      // Otherwise, this is a generic request. Simply look for a token, check that it's not expired, then store it in the ctx.data object for use
      // by any possible validators.
      
      GetToken(ctx.id).then(function(token){
        token = token[0];
        jwt.verify(token, config.secret, function(err, decoded){
          if (!err){
            ctx.data.token = token;
            next();
          } else if (err.name === "TokenExpiredError"){
            ctx.error("Token has expired.");
            next();
          }
        });
      });
    }
  };
};
