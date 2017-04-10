
if (typeof(window.REALM) === 'undefined'){
  throw new Error("REALM object missing.");
}

(function(REALM){
  var user = null;
  var userid = null;
  
  REALM.Emitter.on("connected", function(data){
    user = document.querySelector("#user");
    userid = data.id;
    REALM.server.send();
  });

  REALM.Emitter.on("user_enter", function(data){

  });

  REALM.Emitter.on("user_exit", function(data){

  });
  
})(window.REALM);
