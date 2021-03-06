
/* -----------------------------------------------------------------------
Context
A simple function module that creates a simple wrapper object to handle sending
all required request information and generated response data, usually, between
middleware.
The created context object contains a send function which will send any data within
the response property to the client given to define the context object using the
clients (assumed to be) built in send() method.

@param co An Object that should contain an .id and .client property at minimum. Depending on property data, new context methods may become available.
@param request Object containing the data of the original request.
@param broadcastFunc [OPTIONAL] A function that will broadcast any generated response to all currently connected clients.
----------------------------------------------------------------------- */
module.exports = function(co, request, d){
  var ctx = {
    response: {
      type: request.type,
      status: "success"
    },
    error: function(message){
      errmsg.push(message);
    }
  };

  if (typeof(d) !== typeof({})){
    d = {};
  }
  
  var broadcast = (typeof(d.broadcast) === 'function') ? d.broadcast : function(){};
  var send = (typeof(d.send) === 'function') ? d.send : function(){};

  var data = {};
  var errmsg = [];

  if (co.id !== null){
    ctx.broadcast = function(receivers, exclusive){
      broadcast(ctx.response, receivers, (exclusive === true));
    };

    ctx.send = function(hmackey){
      if (errmsg.length > 0){
	ctx.response = {
	  type: request.type,
	  status: "error",
	  messages: errmsg
	};
      }
      send(co.id, ctx.response, {genhmac: true});
    };
  } else {
    ctx.send = function(){
      if (errmsg.length > 0){
	ctx.response = {
	  type: request.type,
	  status: "error",
	  messages: errmsg
	};
      } else if (typeof(d.register) === 'function'){
	d.register();
      }
      co.client.send(JSON.stringify(ctx.response));
    };

    ctx.broadcast = function(){};
  }

  Object.defineProperties(ctx, {
    "request":{
      enumerable: true,
      get:function(){return request;}
    },

    "id":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: (co.id !== null) ? co.id : "UNVALIDATED"
    },

    "data":{
      get:function(){return data;}
    },

    "errored":{
      get:function(){return (errmsg.length > 0);}
    }
  });

  if (co.id === null){
    Object.defineProperty(ctx, "co", {
      get:function(){return co;}
    });
  }

  return ctx;
};
