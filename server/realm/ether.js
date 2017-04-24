
module.exports = function(sockets, emitter, config, r){
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var logEther = new Logger(config.logDomain + ":ether");

  var workerid = sockets.workerid;

  var validation = require('../middleware/validation')(config, r);

  // TODO: No... seriously... I totally need to be defined!!!
};
