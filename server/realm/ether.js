
module.exports = function(dispatch, config, r){
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var logEther = new Logger(config.logDomain + ":ether");

  var workerid = dispatch.workerid;

  dispatch.handler("connection", require('../middleware/connections')(config, r), function(ctx, err){
    if (!err){
      ctx.send();
    } else {
      logEther.error("[WORKER %d] %s", workerid, err);
    }
  });


  var Ether = {
    // TODO: Actual stuff :p
  };

  return Ether;
};
