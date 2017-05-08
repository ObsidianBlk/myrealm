
if (typeof(window.REALM) === 'undefined'){
  throw new Error("REALM object missing.");
}

(function(REALM){
  var ME = null;
  
  REALM.Emitter.on("connected", function(data){
    var me_el = document.querySelector("#me");
    ME = data;
    me_el.setAttribute("visitor", "username:\"" + ME.username + "\"");
  });

  REALM.Emitter.on("visitor_exit", function(data){

  });


  // -----------------------------------------------------------------------
  // A-Frame component used for this plugin.
  REALM.AFRAME.registerComponent("visitor", {
    schema:{
      username:{default:"visitor"}
    },

    init:function(){
      REALM.Emitter.on("telemetry", function(t){
	if (t.visitor_id === this.v_id){
	  console.log("'" + this.v_id + "' telemetry (" + t.position_x + ", " + t.position.y + ", " + t.position.z + ")");
	  this.setAttribute("position", {
	    x: t.position_x,
	    y: t.position_y,
	    z: t.position_z
	  });
	}
      });
    },

    update:function(oldData){
      console.log(oldData);
    }
  });
  
})(window.REALM);
