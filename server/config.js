
module.exports = (function(){
  // -------------------------------------------------------------------------------------------
// Server.config.json Schema
// -------------------------------------------------------------------------------------------
  var CONFIG_SCHEMA = {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
      "version": {
	"type": "string"
      },
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
      "site": {
	"type": "object",
	"properties": {
	  "title":{
	    "type":"string",
	    "minLength": 1
	  },
	  "description":{
	    "type": "string",
	    "minLength": 1
	  },
	  "plugins":{
	    "type": "array",
	    "items": {
	      "type": "string"
	    },
	    "uniqueItems": true
	  }
	},
	"required": [
	  "title",
	  "description"
	]
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
      "version",
      "secret",
      "redis",
      "http"
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
      site:{
	title:"MyRealm VR",
	description:"MyRealm VR Multiuser Environment."
      },
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

  // --
  // Setting up the bundle scripts to include in the index template.

  config.site.bundle_scripts = [
    "vendor-bundle.js",
    "myrealm-bundle.js"
  ];

  // --

  return config;
})();
