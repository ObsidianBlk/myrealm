
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
module.exports = function(co, request, dispatch){
  var ctx = {
    response: {},
    error: function(message){
      ctx.response.status = "error";
      ctx.response.message = message;
    }
  };

  var tokenData = null;

  if (co.id !== null){
    ctx.broadcast = function(){
      dispatch.broadcast(ctx.response, co.id);
    };

    ctx.send = function(){
      dispatch.send(co.id, ctx.response);
    };
  } else {
    ctx.send = function(){
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

    "token":{
      get:function(){return tokenData;},
      set:function(d){
	if (d.name === Object.name){
	  if (tokenData !== null){
	    throw new Error("Token data can only be defined once.");
	  }
	  tokenData = d;
	} else {
	  throw new TypeError("Expected Object instance.");
	}
      }
    }
  });

  if (co.id === null){
    Object.defineProperty(ctx, "co", {
      get:function(){return co;}
    });
  }

  return ctx;
};
