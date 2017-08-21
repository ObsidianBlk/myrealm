
module.exports = function(m, r, config){
  var Promise = require('bluebird');
  var Logger = require('../utils/logger')(config.logging);
  var logEther = new Logger(config.logDomain + ":ether");
  var workerid = m.sockets.workerid;

  //var mwValidation = require('../middleware/validation')(config, r);

  var namespace = {
    entity:"entity" // More to come.
  };


  function HMGetResultTransformer(result){
    if (Array.isArray(result) === true){
      var o = {};
      for (var i=0; i < result.length; i+=2){
	o[result[i]] = result[i+1];
      }
    }
    return result;
  }

  /**
   * Adds the definition for a new realm entity. All attributes are named and expect the same values as a-frame <a-entity> attributes.
   * A special __parent (double underscores) attribute can be given set to the ID value of another entity that will act as this entity's parent.
   * NOTE: Calling this method on an already defined entity id will update the entity attributes. If replace is true, any previously defined
   * entity data will be cleared and the given data stored fresh.
   *
   * @method ether.defineEntity
   * @param {string} id - The id of this new entity.
   * @param {object} attribs - An object whos keys/values are the attribute names/values to use for the entity.
   * @param {boolean} [replace=false] - If true, any currently stored entity information under the given id will be removed and replaced with this new data.
   */
  m.requester.define("ether.defineEntity", function(id, attribs, perms, replace){
    return new Promise(function(resolve, reject){
      var keyEntityList = r.Key(namespace.entity);
      var keyAttribs = r.Key(namespace.entity, id, "attribs");
      var keyPerms = r.Key(namespace.entity, id, "perms");
      var m = r.pub.multi();

      // If possibly replacing an old entity with a new one, queue the del commands.
      if (replace === true){
	m.del(keyAttribs);
	m.del(keyPerms);
      }

      // If we have attributes to define, then set the hash and return the has values.
      // TODO: Somehow only allow attribs to be null if entity with id already exists, otherwise, an entity requires attributes.
      if (attribs !== null){
	m.hmset(keyAttribs, attribs)
	  .hmget(keyAttribs);
      }

      // If permissions are given, set then get them like with the attributes.
      // NOTE: An entity with no permissions is considered a "system" entity.
      if (perms !== null){
	m.hmset(keyPerms, perms)
	  .hmget(keyPerms);
      }

      // Execute the redis transaction and process the result.
      m.exec().then(function(result){
	// TODO: Mostly finish this!
	// Find and format the attribs and permissions (if they exist) for broadcast.
	m.sockets.broadcast({
	  type:"ether-entity",
	  data:null
	});
      }).error(function(err){
	reject(err);
      });
    });
  });

};
