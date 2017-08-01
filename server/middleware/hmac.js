module.exports = function(config, r){
  //var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:hmac");

  /*
    Generates a hmac value from the current ctx.response object, then stores that in ctx.response.hmac
   */
  return function(ctx, next){
    // TODO: You know... generate the hmac, bro!
    next();
  };
};
