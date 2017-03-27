
/* -----------------------------------------------------------------------
Context
A simple function module that creates a simple wrapper object to handle sending
all required request information and generated response data, usually, between
middleware.
The created context object contains a send function which will send any data within
the response property to the client given to define the context object using the
clients (assumed to be) built in send() method.

@param id Current ID of the client which sent the request.
@param client The WebSocket client object that sent the request.
@param request Object containing the data of the original request.
@param broadcastFunc [OPTIONAL] A function that will broadcast any generated response to all currently connected clients.
----------------------------------------------------------------------- */
module.exports = function(id, client, request, dispatch){
  var ctx = {
    response: {},
    broadcast: function(){
      dispatch.broadcast(ctx.response, id);
    },
    send: function(){
      dispatch.send(id, ctx.response);
    }
  };

  Object.defineProperties(ctx, {
    "request":{
      enumerable: true,
      get:function(){return request;}
    },

    "id":{
      enumerable: true,
      writable: false,
      configurable: false,
      value: id
    }
  });

  return ctx;
};
