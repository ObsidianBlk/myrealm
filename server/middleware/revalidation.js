
module.exports = function(config, r){
  var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:revalidation");

  var tokenExpirationTime = (config.tokenExpiration) ? config.tokenExpiration : 900; // Default is 900 seconds (15 minutes)


  return function(ctx, next){
    // TODO: Check to see if tokenData contains any 3rd party tokens (such as google or facebook) and revalidate those as well
    // before regenerating the token.
    var token = jwt.sign(ctx.tokenData, config.secret, {expiresIn:tokenExpirationTime});
    var rkey = r.Key("visitor", ctx.id);
    ctx.response.type = ctx.request.type;
    r.pub.hset(rkey, "token", token).then(function(){
      ctx.response.status = "success";
      ctx.response.token = token;
      ctx.response.data = ctx.tokenData;
      log.debug("Revalidated for client '%s'", ctx.id);
      next();
    });
  };
};
