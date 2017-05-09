
if (typeof(window.REALM) === 'undefined'){
  throw new Error("REALM object missing.");
}

(function(REALM){
  var ME = null;
  
  REALM.Emitter.on("connected", function(data){
    var me_el = document.querySelector("#me");
    ME = data;
    me_el.setAttribute("vcam", "username:" + ME.username + ";v_id:" + ME.id + "");
  });

  REALM.Emitter.on("visitor_exit", function(data){

  });

  // -----------------------------------------------------------------------
  // A-Frame component for visitors!
  REALM.AFRAME.registerComponent("visitor", {
    schema:{
      v_id:{default: "000"},
      username:{default:"visitor"}
    },

    init:function(){
      this.__HANDLER_Telemetry = (function(t){
	if (t.visitor_id === this.data.v_id){
	  var camera = this.el.getAttribute("camera");
	  camera = (camera) ? camera : {userHeight: 1.6};

	  var telemetry = {};
	  if (typeof(t.position_x) === 'number' && typeof(t.position_y) === 'number' && typeof(t.position_z) === 'number'){
	    telemetry.x = t.position_x;
	    telemetry.y = t.position_y + camera.userHeight;
	    telemetry.z = t.position_z;
	    this.el.setAttribute("position", telemetry);
	  }

	  if (typeof(t.rotation_x) === 'number' && typeof(t.rotation_y) === 'number' && typeof(t.rotation_z) === 'number'){
	    telemetry.x = t.rotation_x;
	    telemetry.y = t.rotation_y;
	    telemetry.z = t.rotation_z;
	    this.el.setAttribute("rotation", telemetry);
	  }
	}
      }).bind(this);
      
      REALM.Emitter.on("telemetry", this.__HANDLER_Telemetry);
    }
  });

  
  // -----------------------------------------------------------------------
  // A-Frame component for the user!
  REALM.AFRAME.registerComponent("vcam", {
    schema:{
      v_id:{default: "000"},
      username:{default:"visitor"}
    },

    init:function(){
      this.__LastTelemetry = {x:0.0, y:0.0, z:0.0};
      this.__HANDLER_Telemetry = (function(t){
	if (t.visitor_id === this.data.v_id){
	  var camera = this.el.getAttribute("camera");
	  camera = (camera) ? camera : {userHeight: 1.6};

	  this.__LastTelemetry.x = t.position_x;
	  this.__LastTelemetry.y = t.position_y + camera.userHeight;
	  this.__LastTelemetry.z = t.position_z;
	  
	  this.el.setAttribute("position", this.__LastTelemetry);
	}
      }).bind(this);
      
      REALM.Emitter.on("telemetry", this.__HANDLER_Telemetry);

      this.el.addEventListener('componentchanged', (function (evt) {
	var ndata = evt.detail.newData;
	switch(evt.detail.name){
	case 'position':
	  if (this.__LastTelemetry !== null &&
	      (ndata.x !== this.__LastTelemetry.x || ndata.y !== this.__LastTelemetry.y || ndata.z !== this.__LastTelemetry.z)){
	    var odata = evt.detail.oldData;
	    var delta = {
	      position_dx: ndata.x - odata.x,
	      position_dy: ndata.y - odata.y,
	      position_dz: ndata.z - odata.z
	    };
	    REALM.Server.send("visitor_move", delta);
	  }
	  break;
	case 'rotation':
	  REALM.Server.send("visitor_orientation", {
	    rotation_x: ndata.x,
	    rotation_y: ndata.y,
	    rotation_z: ndata.z
	  });
	  break;
	}
	console.log(evt);
      }).bind(this));
    },

    update:function(oldData){
      console.log(oldData);
    },

    remove:function(){
      REALM.Emitter.unlisten("telemetry", this.__HANDLER_Telemetry);
    }
  });
  
})(window.REALM);
