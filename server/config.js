
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
      "views_path": { // The relative (to www_path) or absolute path to the view folder for this sub-realm.
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
      "views_path",
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
      "list":{
	"type": "array",
	"minItems":1,
	"items": {
	  "type": ["object", "string"],
	  "minLength": 1
	}
      }
    },
    "required":[
      "bundle_scripts",
      "list"
    ]
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
	"min": 0 // If 0, then terminal is considered disabled.
      },
      "authCode":{
	"type": "string"
      }
    },
    "required": [
      "host",
      "port",
      "maxConnections",
      "authCode"
    ]
  };

  var CSUB_MODULES = {
    "type": "object",
    "properties": {
      "mod_path":{
	"type": "string",
	"minLength": 1
      },
      "mods":{
	"type": "array",
	"minItems":1,
	"items": {
	  "type": "string",
	  "minLength": 1
	}
      }
    }
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
      "port":{
	"type": "integer"
      },
      "modules": { // If object, then refer to CSUB_MODULES schema. If string, a path to find the Modules configuration JSON.
	"type": ["object", "string"],
	"minLength": 1
      },
      "terminal": { // If object, then refer to CSUB_TERMINAL schema. If string, a path to find the Terminal configuration JSON.
	"type": ["object", "string"],
	"minLength":1
      },
      "redis": { // If object, then refer to CSUB_REDIS schema. If string, a path to find the Redis configuration JSON.
	"type": ["object", "string"],
	"minLength":1
      },
      "realms":{ // If object, then refer to CSUB_REALMS schema. If string, a path to find the Realms configuration JSON.
        "type": ["object", "string"],
	"minLength": 1
      },
      "logging": {
	"type": "object",
	"properties":{
	  "info_enabled":{
	    "type":"boolean"
	  },
	  "error_enabled":{
	    "type":"boolean"
	  },
	  "warning_enabled":{
	    "type":"boolean"
	  },
	  "debug_enabled":{
	    "type":"boolean"
	  },
	  "all":{
	    "type":"boolean"
	  }
	}
      }
    },
    "required": [
      "port",
      "secret",
      "redis",
      "realms"
    ]
  };

  var DEFAULT_CONFIG_PATH = "./server.config.json";
  var path = require('path');
  var fs = require('fs');
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

  // If configuration is invalid, throw a fit!
  if (config !== null && tv4.validate(config, CONFIG_SCHEMA) === false){
    throw new Error("Server.config.json is invalid.\"" + tv4.error.message + "\".");
  }

  // Setting defaults if not defined.
  if (typeof(config.logDomain) !== 'string'){
    config.logDomain = "MYREALM";
  }

  if (typeof(config.tokenExpiration) !== 'number'){
    config.tokenExpiration = 900; // (in seconds) Approximately 15 minutes.
  }

  // ------------------------------------------------------------------------------
  // Load REDIS config if string
  // ------------------------------------------------------------------------------
  if (typeof(config.redis) === 'string'){
    var rpath = path.resolve(config.redis);
    var stat = fs.lstatSync(rpath);
    if (stat.isFile() === false){
      throw new Error("Redis configuration path '" + rpath + "' missing or not a file.");
    }
    config.redis = require(rpath);
  }
  // ------------------------------------------------------------------------------
  // Validate REDIS config.
  // ------------------------------------------------------------------------------
  if (tv4.validate(config.redis, CSUB_REDIS) === false){
    throw new Error("REDIS config is invalid.\"" + tv4.error.message + "\".");
  }

  if (typeof(config.redis.connectionTimeout) !== 'number'){
    config.redis.connectionTimeout = 5;
  }

  if (typeof(config.redis.serverkey) !== 'string'){
    config.redis.serverkey = "";
  }


  // ------------------------------------------------------------------------------
  // Load REALMS config if string
  // ------------------------------------------------------------------------------
  if (typeof(config.realms) === 'string'){
    var rpath = path.resolve(config.realms);
    var stat = fs.lstatSync(rpath);
    if (stat.isFile() === false){
      throw new Error("Realms configuration path '" + rpath + "' missing or not a file.");
    }
    config.realms = require(rpath);
  }
  // ------------------------------------------------------------------------------
  // Validate REALMS config.
  // ------------------------------------------------------------------------------
  if (tv4.validate(config.realms, CSUB_REALMS) === false){
    throw new Error("REALMS config is invalid.\"" + tv4.error.message + "\".");
  }
  // Now must load/validate actual realms :)
  var rlist = config.realms.list;
  for (var i=0; i < rlist.length; i++){
    // Load REALM config if string
    if (typeof(rlist[i]) === 'string'){
      var rpath = path.resolve(rlist[i]);
      var stat = fs.lstatSync(rpath);
      if (stat.isFile() === false){
	throw new Error("Realm configuration path '" + rpath + "' missing or not a file.");
      }
      rlist[i] = require(rpath);
    }
    // Validate Realm config
    if (tv4.validate(rlist[i], CSUB_REALM) === false){
      throw new Error("REALM config is invalid. \"" + tv4.error.message + "\".");
    }
  }


  // ------------------------------------------------------------------------------
  // Define/Load TERMINAL config if undefined/string
  // ------------------------------------------------------------------------------
  if (typeof(config.terminal) === 'undefined'){
    config.terminal = { // A default, disabled terminal.
      host: "",
      port: 0,
      maxConnections: 0,
      authCode: ""
    };
  } else {
    if (typeof(config.terminal) === 'string'){
      var tpath = path.resolve(config.terminal);
      var stat = fs.lstatSync(tpath);
      if (stat.isFile() === false){
	throw new Error("Terminal configuration path '" + tpath + "' missing or not a file.");
      }
      config.terminal = require(tpath);
    }
  }
  // ------------------------------------------------------------------------------
  // Validate Terminal config.
  // ------------------------------------------------------------------------------
  if (tv4.validate(config.terminal, CSUB_TERMINAL) === false){
    throw new Error("TERMINAL config is invalid. \"" + tv4.error.message + "\".");
  }

  // ------------------------------------------------------------------------------
  // Load Modules config if given!
  // ------------------------------------------------------------------------------
  if (typeof(config.modules) !== 'undefined'){
    if (typeof(config.modules) === 'string'){
      var mpath = path.resolve(config.terminal);
      var stat = fs.lstatSync(lpath);
      if (stat.isFile() === false){
	throw new Error("Modules configuration path '" + mpath + "' missing or not a file.");
      }
      config.modules = require(mpath);

      // ------------------------------------------------------------------------------
      // Validate Modules config if given!
      // ------------------------------------------------------------------------------
      if (tv4.validate(config.modules, CSUB_MODULES) === false){
	throw new Error("MODULES config is invalid. \"" + tv4.error.message + "\".");
      }
    }
  }
  
  // ------------------------------------------------------------------------------
  // Load Logging config if given!
  // ------------------------------------------------------------------------------
  if (typeof(config.logging) !== 'undefined'){
    if (typeof(config.logging) === 'string'){
      var lpath = path.resolve(config.terminal);
      var stat = fs.lstatSync(lpath);
      if (stat.isFile() === false){
	throw new Error("Logging configuration path '" + lpath + "' missing or not a file.");
      }
      config.logging = require(lpath);

      // ------------------------------------------------------------------------------
      // Validate Logging config if given!
      // ------------------------------------------------------------------------------
      if (tv4.validate(config.logging, CSUB_LOGGING) === false){
	throw new Error("LOGGING config is invalid. \"" + tv4.error.message + "\".");
      }
    }
  }

  
  // ------------------------------------------------------------------------------
  // DONE! Return loaded/generated config!
  // ------------------------------------------------------------------------------
  return config;
})();
