
module.exports = function(config, r){
  var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var shortid = require('shortid');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:validation");


  return function(ctx, next){
    var token = ctx.request.token;
    if (typeof(token) !== 'string'){
      log.debug("Missing or invalid token value.");
      throw new Error("Missing or invalid token value.");
    }

    try {
      var decoded = jwt.verify(token, config.secret);
    } catch (e) {
      if (e.name === "TokenExpiredError"){
        log.debug("Token expired");
	throw new Error("Token expired.");
      } else {
        log.debug("Token malformed or missing required information.");
	throw new Error("Token malformed or missing required information.");
      }
    }
    
    if (typeof(decoded.id) !== 'string'){
      throw new Error("Token contains invalid ID.");
    }
    if (decoded.id !== ctx.id){
      throw new Error("Token and Client ID mismatch!");
    }

    var rkey = r.Key("visitor", ctx.id);
    r.pub.hget(rkey, "token").then(function(rtoken){
      if (rtoken !== token){
	throw new Error("Current token does not match request token.");
      }

      try {
	ctx.tokenData = decoded;
      } catch (e) {
	log.error(e);
	throw new Error("Unknown server error occured.");
      }
      next(); // <-- HERE we know everything seems valid!
    }).catch(function(e){
      throw e;
    });
  };
};
