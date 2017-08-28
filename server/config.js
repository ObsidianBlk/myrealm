
module.exports = (function(){
  // -------------------------------------------------------------------------------------------
  // Defining configuration sub-schema
  // -------------------------------------------------------------------------------------------
  // Configuration for REDIS connections.
  var CSUB_REDIS = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
      "host": {
        "type": "string"
      },
      "port": {
        "type": "integer"
      },
      "connectionTimeout":{
	"type": "integer"
      },
      "serverkey":{
	"type": "string"
      }
    },
    "required": [
      "host",
      "port"
    ]
  };

  // Configuration for a single REALM (aka, sub-domain)
  var CSUB_REALM = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
      "domain_name":{ // Example: "/", "/Realm1", "/User_12345"
	"type":"string",
	"minlength": 1
      },
      "www_path": { // The path to the root directory for this sub-realm.
	"type":"string",
	"minlength": 1
      },
      "view_path": { // The relative (to www_path) or absolute path to the view folder for this sub-realm.
	"type":"string",
	"minlength": 1
      },
      "partials_path": { // The relative (to view_path) or absolute path to the partials folder (by default assumed to be "./partials") for this sub-realm.
	"type":"string",
	"minlength": 1
      },
      "partials": { // List of partials to load. If ommitted, all files in the partials folder will be loaded.
	"type": "array",
	"items": {
	  "type":"string",
	  "minlength": 1
	}
      },
      "enabled": { // If false, this realm won't be configured during server setup. NOTE: MUST be true for the root ("/") realm.
	"type": "boolean"
      },
      "context": { // Context to use for the view templates.
	"type":"object"
      }
    },
    "required":[
      "domain_name",
      "www_path",
      "view_path",
      "enabled"
    ]
  };

  // Configuration for REALMS (aka, sub-domains)
  var CSUB_REALMS = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
      "bundle_scripts":{
	"type": "array",
        "minItems": 1,
        "items": {
	  "type": "string"
        }
      },
      "realms":{
	"type": "array",
	"minItems":1,
	"items": {
	  "type": "object"
	}
      }
    }
  };

  // Configuration for the logging system
  var CSUB_LOGGING = {
    "type": "object",
    "properties": {
      "minLevel": ["integer", "string"],
      "maxLevel": ["integer", "string"]
    },
    "require": [
      "minLevel",
      "maxLevel"
    ]
  };

  // Configuration for the terminal access system.
  var CSUB_TERMINAL = {
    "type": "object",
    "properties":{
      "host": {
        "type": "string"
      },
      "port": {
        "type": "integer"
      },
      "maxConnections": {
	"type": "integer",
	"min": 1
      },
      "authCode":{
	"type": "string",
	"minLength": 1
      },
      "enabled": {
	"type": "boolean"
      }
    },
    "required": [
      "host",
      "port",
      "maxConnections",
      "authCode"
    ]
  };
  
  // -------------------------------------------------------------------------------------------
  // Server.config.json Schema
  // -------------------------------------------------------------------------------------------
  var CONFIG_SCHEMA = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
      "processes": {
	"type": "integer"
      },
      "logDomain":{
	"type": "string",
	"minLength": 1
      },
      "secret": {
	"type": "string",
	"minLength": 4
      },
      "tokenExpiration": {
	"type": "integer",
	"min": 1
      },
      "terminal": {
	"type": "object",
	"properties":{
	  "host": {
            "type": "string"
          },
          "port": {
            "type": "integer"
          },
	  "maxConnections": {
	    "type": "integer",
	    "min": 1
	  },
	  "authCode":{
	    "type": "string",
	    "minLength": 1
	  },
	  "enabled": {
	    "type": "boolean"
	  }
	},
	"required": [
	  "host",
	  "port",
	  "maxConnections",
	  "authCode"
	]
      },
      "redis": {
	"type": "object",
	"properties": {
          "host": {
            "type": "string"
          },
          "port": {
            "type": "integer"
          },
	  "connectionTimeout":{
	    "type": "integer"
	  },
	  "serverkey":{
	    "type": "string"
	  }
	},
	"required": [
          "host",
          "port"
	]
      },
      "http": {
	"type": "object",
	"properties": {
          "port": {
            "type": "integer"
          },
	  "www":{
	    "type": "string",
	    "minLength": 1
	  },
	  "views":{
	    "type": "string",
	    "minLength": 1
	  },
	  "partials":{
	    "type": "string",
	    "minLength": 1
	  }
	},
	"required": [
          "port"
	]
      },
      "realms":{
        "type": "array",
        "minItems":1,
        "items": {
          "type": "object",
          "properties": {
            "subrealm": {
              "type": "string"
            },
            "context": {
              "type": "object"
            },
            "context_path": {
              "type": "string",
              "minLength": 1
            },
            "bundle_scripts":{
              "type": "array",
              "minItems": 1,
              "items": {
                "type": "string"
              }
            }
          },
          "anyOf": [
            {"required":["subrealm"]},
            {"required":["subrealm", "context"]},
            {"required":["subrealm", "context_path"]}
          ]
        }
      },
      "logging": {
	"type": "object",
	"properties": {
	  "minLevel": ["integer", "string"],
	  "maxLevel": ["integer", "string"]
	},
	"require": [
	  "minLevel",
	  "maxLevel"
	]
      }
    },
    "required": [
      "secret",
      "redis",
      "http",
      "realms"
    ]
  };

  var DEFAULT_CONFIG_PATH = "server.config.json";
  var path = require('path');
  var tv4 = require('tv4');

  // -------------------------------------------------------------------------------------------
  // Check process.env for "MYREALM_CONFIG_PATH" property, which should contain an alternate path to the config file.
  // -------------------------------------------------------------------------------------------
  var config_path = (typeof(process.env.MYREALM_CONFIG_PATH) === 'string') ? process.env.MYREALM_CONFIG_PATH : DEFAULT_CONFIG_PATH;

  // -------------------------------------------------------------------------------------------
  // Loading in the Config file (if it exists)...
  // -------------------------------------------------------------------------------------------
  var config = null;
  try {
    config = require(path.resolve(config_path));
  } catch (e) {
    console.error("Failed to load '" + config_path + "'.\n\"" + e.message + "\".");
    config = null;
  }
  if (config === null && config_path !== DEFAULT_CONFIG_PATH){
    try{
      console.log("Attempting to load default configuration path...");
      config = require(path.resolve(DEFAULT_CONFIG_PATH));
    } catch (e){
      console.error("Failed to load '" + DEFAULT_CONFIG_PATH + "'.\n\"" + e.message + "\".\nUsing default configuration.");
      config = null;
    }
  }

  if (config !== null && tv4.validate(config, CONFIG_SCHEMA) === false){
    console.error("Server.config.json is invalid.\"" + tv4.error.message + "\"\nUsing default configuration.");
    config = null;
  }

  if (config === null){
    config = {
      version:"1.0.0",
      processes:0,
      redis:{
	host:"localhost",
	port:6379
      },
      http:{
	port:3000
      },
      realms:[
        {
          subrealm:"",
          context:{
            title: "MyRealm VR",
            description: "MyRealm VR Multiuser Environment."
          }
        }
      ],
      logging:{
	minLevel:"debug",
	maxLevel:"error"
      }
    };
  }

  if (typeof(config.logDomain) !== 'string'){
    config.logDomain = "MYREALM";
  }

  if (typeof(config.redis.connectionTimeout) !== 'number'){
    config.redis.connectionTimeout = 5;
  }

  if (typeof(config.redis.serverkey) !== 'string'){
    config.redis.serverkey = "";
  }

  if (typeof(config.terminal) === 'undefined'){
    config.terminal = {enabled: false};
  }
  // I know this looks redundant, but "enabled" isn't required by the schema... so I force it to exist. What? Set defaults you say?
  if (config.terminal.enabled !== true){
    config.terminal.enabled = false;
  }

  // Need to check the realms list to make sure the root sub-realm ("") actually exists!
  var rootRealmFound = false;
  for (var i=0; i < config.realms.length; i++){
    if (config.realms[i].subrealm === ""){
      rootRealmFound = true;
      break;
    }
  }
  if (rootRealmFound === false){
    console.error("WARNING: Required root sub-realm not defined!");
  }

  return config;
})();
