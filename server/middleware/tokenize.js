module.exports = function(config, r){
  var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var shortid = require('shortid');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:tokenize");

  var tokenExpirationTime = (config.tokenExpiration) ? config.tokenExpiration : 900; // Default is 900 seconds (15 minutes)


  /*
    Generates a new token if ctx.tokenize === true
   */
  return function(ctx, next){
    // TODO: You know... tokenize :)
    next();
  };
};
