
module.exports = function(config, r){
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var log = new Logger(config.logDomain + ":middleware:visitorInfo");

  return {
    update: function(ctx, next){
      // The "allowed" keys that can be set by the visitor. These can be explicitly set in the config file under the <visitor_keys> property.
      // Otherwise, all keys are allowed (except <id>... this is never allowed to be changed by the user).
      var allowed = (typeof(config.visitor_keys) !== 'undefined') ? config.visitor_keys : [];
      
      var ndata = ctx.request.data;
      var odata = ctx.data.vdata;
      var keys = new Set(Object.keys(odata).concat(Object.keys(ndata)));
      var vdata = {
	id: odata.id // Always use the original data's <id> property. This cannot be changed by the user.
      };

      keys.forEach(function(key){
	if (key === "id"){return;}
	if (allowed.length <= 0 || allowed.indexOf(key) !== -1){
	  if (ndata.hasOwnProperty(key) === true){
	    vdata[key] = ndata[key];
	  } else if (odata.hasOwnProperty(key) === true){
	    vdata[key] = odata[key];
	  }
	}
      });
      log.debug("Updating Client '%s' data to %o", ctx.id, vdata);

      var rkey = r.Key("visitor", ctx.id + "_data");
      r.pub.hmset(rkey, vdata)
	.then(next)
	.catch(function(err){
	  log.error("UPDATE FAILED: \"%s\"", err.message);
	  ctx.error("Failed to update visitor information");
	  next();
	});
    }
  };
};
