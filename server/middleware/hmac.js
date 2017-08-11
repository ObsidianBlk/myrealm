module.exports = function(config, r){
  //var jwt = require('jsonwebtoken');
  var Promise = require('bluebird');
  var hmac = require('crypto-js/hmac-sha256');
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
	throw new Error("Missing required HMAC parameter!");
      }
      if (typeof(ctx.data.token) !== 'string'){
	throw new Error("No token available to verify request HMAC.");
      }

      var rmsg = {type:ctx.request.type};
      if (typeof(ctx.request.data) !== 'undefined'){
	rmsg.data = ctx.request.data;
      }
      var res = hmac(JSON.stringify(rmsg), ctx.data.token);
      if (res !== ctx.request.hmac){
	throw new Error("Request HMAC mismatch!");
      }
      next();
    },

    /*
      Generate an hmac value from the current ctx.response field state and stores the result in ctx.response.hmac
     */
    generateHMAC: function(ctx, next){
      if (ctx.errored === true){next();}
      if (typeof(ctx.response.status) !== 'string'){
	throw new Error("Response missing status parameter.");
      }
      if (typeof(ctx.data.token) !== 'string'){
	throw new Error("No token available to generate output HMAC.");
      }

      // We only generate HMAC values for successful responses.
      if (ctx.response.status === "success"){
	var msg = {
	  type: ctx.response.type,
	  status: ctx.response.status,
	  data: ctx.response.data
	};
	ctx.response.hmac = hmac(JSON.stringify(msg), ctx.data.token);
      }
      next();
    }
  };
};
