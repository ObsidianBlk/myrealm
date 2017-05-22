
module.exports = (function(){
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
	  "path":{
	    "type": "string",
	    "minLength": 1
	  }
	},
	"required": [
          "port",
	  "path"
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

  var path = require('path');
  var tv4 = require('tv4');

  // -------------------------------------------------------------------------------------------
  // Loading in the Config file (if it exists)...
  // -------------------------------------------------------------------------------------------
  try {
    var config = require(path.resolve('server.config.json'));
  } catch (e) {
    console.error("Failed to load 'server.config.json'.\n\"" + e.message + "\".\nUsing default configuration.");
    config = null;
  }

  if (config !== null && tv4.validate(config, CONFIG_SCHEMA) === false){
    console.error("Server.config.json is invalid.\nUsing default configuration.");
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
