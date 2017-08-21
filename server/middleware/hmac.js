module.exports = function(config, r){
  //var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var Crypto = require('crypto-js');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:hmac");


  return {
    /*
      Builds an HMAC value from the given ctx.request field using the token stored at ctx.data.token as the key.
      Fails if the result doesn't match ctx.request.hmac
     */
    verifyHMAC: function(ctx, next){
      if (ctx.errored === true){next();}
      if (typeof(ctx.request.hmac) !== 'string'){
	ctx.error("Missing required HMAC parameter!");
	next();
	return;
      }
      if (typeof(ctx.data.token) !== 'string'){
	ctx.error("No token available to verify request HMAC.");
	next();
	return;
      }

      var rmsg = {type:ctx.request.type};
      if (typeof(ctx.request.data) !== 'undefined'){
	rmsg.data = ctx.request.data;
      }
      var res = Crypto.HmacSHA256(JSON.stringify(rmsg), ctx.data.token).toString(Crypto.enc.Hex);
      if (res !== ctx.request.hmac){
	ctx.error("Request HMAC mismatch!");
      }
      next();
    },

    /*
      Generate an hmac value from the current ctx.response field state and stores the result in ctx.response.hmac
     */
    generateHMAC: function(ctx, next){
      if (ctx.errored === true){next();}
      if (typeof(ctx.response.status) !== 'string'){
	ctx.error("Response missing status parameter.");
      }
      if (typeof(ctx.data.token) !== 'string'){
	ctx.error("No token available to generate output HMAC.");
      }

      // We only generate HMAC values for successful responses.
      if (ctx.errored === false){
	var msg = {
	  type: ctx.response.type,
	  status: ctx.response.status,
	  data: ctx.response.data
	};
	ctx.response.hmac = Crypto.HmacSHA256(JSON.stringify(msg), ctx.data.token).toString(Crypto.enc.Hex);
      }
      next();
    }
  };
};
