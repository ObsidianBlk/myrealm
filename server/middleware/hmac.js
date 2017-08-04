module.exports = function(config, r){
  //var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var hmac = require('crypto-js/hmac-sha256');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:hmac");

  /*
    Generates a hmac value from the current ctx.response object, then stores that in ctx.response.hmac
    This should be the last function in the middleware construct.
   */
  return function(ctx, next){
    if (typeof(ctx.data.token) === 'string'){
      ctx.response.hmac = hmac(JSON.stringify(ctx.response), ctx.data.token);
    }
    next();
  };
};
