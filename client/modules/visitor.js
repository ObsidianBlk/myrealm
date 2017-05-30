
if (typeof(window.REALM) === 'undefined'){
  throw new Error("REALM object missing.");
}

(function(REALM){
  var SCENE = (function(){
    var scene = null;
    return function(){
      if (scene === null){
	var s = document.getElementsByTagName("a-scene");
	scene = (s.length > 0) ? s[0] : null;
      }
      return scene;
    };
  })();
  var VISITOR_TEMPL = (function(){
    var body_template = "";
    var head_template = "";
    
    var t = {};
    Object.defineProperties(t, {
      "head":{
	enumerable: true,
	get:function(){
	  if (head_template === "") {
	    var e = document.querySelector("#visitor_head_templ");
	    if (e !== null){
	      head_template = e.innerHTML;
	    }
	  }
	  return head_template;
	}
      },

      "body":{
	enumerable: true,
	get:function(){
	  if (body_template === "") {
	    var e = document.querySelector("#visitor_body_templ");
	    if (e !== null){
	      body_template = e.innerHTML;
	    }
	  }
	  return body_template;
	}
      }
    });

    return t;
  })();
  var ME = null;
  
  REALM.Emitter.on("connected", function(data){
    var me_el = document.querySelector("#me");
    ME = data;
    me_el.setAttribute("vcam", "username:" + ME.username + ";v_id:" + ME.id + "");
    REALM.Server.send("visitor_list"); // Request a list of already connected visitors. (results will come in as "visitor_enter" events).
  });

  REALM.Emitter.on("visitor_enter", function(data){
    var t = data.telemetry;
    var scene = SCENE();

    console.log("NEW VISITOR!");
    console.log(data);

    var el = document.querySelector("#" + data.visitor_id);
    if (el === null){ // Don't re-add a visitor already being tracked.
      el = document.createElement("a-entity");
      el.setAttribute("id", data.visitor_id);
      el.innerHTML = VISITOR_TEMPL.head + VISITOR_TEMPL.body;
      scene.appendChild(el);
      
      el.setAttribute("visitor", "v_id:" + data.visitor_id + ";username:Visitor_" + data.visitor_id);
      el.setAttribute("position", t.position_x + " " + t.position_y + " " + t.position_z);
    }
  });

  REALM.Emitter.on("visitor_exit", function(data){
    var el = document.querySelector("#" + data.visitor_id);
    if (el !== null){
      var eParent = el.parentElement;
      if (eParent !== null){
	eParent.removeChild(el);
      }
    }
  });
  

  // -----------------------------------------------------------------------
  // A-Frame component for visitors!
  REALM.AFRAME.registerComponent("visitor", {
    schema:{
      v_id:{default: "000"},
      username:{default:"visitor"}
    },

    init:function(){
      var userHeight = 1.6;
      var visitor = (function(el){
	var v = {};
	var head = null;
	var body = null;
	Object.defineProperties(v, {
	  "head":{
	    enumerable: true,
	    get:function(){
	      if (head === null){
		var h = el.getElementsByClassName("visitor_head");
		head = (h.length > 0) ? h[0] : null;
		if (head !== null){
		  head.setAttribute("position", "y", userHeight);
		}
	      }
	      return head;
	    }
	  },

	  "body":{
	    enumerable: true,
	    get:function(){
	      if (body === null){
		var b = el.getElementsByClassName("visitor_body");
		body = (b.length > 0) ? b[0] : null;
	      }
	      return body;
	    }
	  }
	});
	return v;
      })(this.el);

      this.__HANDLER_Telemetry = (function(t){
	if (t.visitor_id === this.data.v_id){
	  console.log("Updating telemetry for " + t.visitor_id);
	  var telemetry = {};
	  var head = visitor.head;
	  var body = visitor.body;
	  if (typeof(t.position_x) === 'number' && typeof(t.position_y) === 'number' && typeof(t.position_z) === 'number'){
	    telemetry.x = t.position_x;
	    telemetry.y = t.position_y;
	    telemetry.z = t.position_z;
	    this.el.setAttribute("position", telemetry);
	  }

	  if (typeof(t.rotation_x) === 'number' && typeof(t.rotation_y) === 'number' && typeof(t.rotation_z) === 'number'){
	    telemetry.x = t.rotation_x;
	    telemetry.y = t.rotation_y;
	    telemetry.z = t.rotation_z;
	    body.setAttribute("rotation", telemetry);
	  }

	  if (head !== null && typeof(t.facing_x) === 'number' && typeof(t.facing_y) === 'number' && typeof(t.facing_z) === 'number'){
	    telemetry.x = t.facing_x;
	    telemetry.y = t.facing_y;
	    telemetry.z = t.facing_z;
	    head.setAttribute("rotation", telemetry);
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
      username:{default:"visitor"},
      mindelta:{default:0.1},
      cameraClass:{default: "camera"}
    },

    getCameraElement:(function(){
      var camera = null;
      return function(){
	if (camera === null){
	  var c = this.el.getElementsByClassName(this.data.cameraClass);
	  if (c.length > 0){
	    camera = c[0];
	  }
	}
	return camera;
      };
    })(),

    getCameraComponent:function(){
      var cam_el = this.getCameraElement();
      if (cam_el !== null){
	var camera = cam_el.getAttribute("camera");
	return (camera) ? camera : null;
      }
      return null;
    },

    getUserHeight:function(){
      var camera = this.getCameraComponent();
      return (camera) ? camera.userHeight : 0;
    },

    setTelemetry:function(x, y, z, clean){
      this._telemetry.currpos.x = ((typeof(x) === 'number' || typeof(x) === 'string') ? Number(x) : 0);
      this._telemetry.currpos.y = ((typeof(y) === 'number' || typeof(y) === 'string') ? Number(y) : 0);
      this._telemetry.currpos.z = ((typeof(z) === 'number' || typeof(z) === 'string') ? Number(z) : 0);
      if (clean === true){
	this.cleanTelemetry();
      }
    },

    getTelemetry:function(includeUserHeight){
      var userheight = (includeUserHeight === true) ? this.getUserHeight() : 0;

      return {
	x: this._telemetry.currpos.x,
	y: this._telemetry.currpos.y + userheight,
	z: this._telemetry.currpos.z
      };
    },

    getTelemetryDelta:function(clean){
      var d = {
	position_dx: this._telemetry.currpos.x - this._telemetry.lastpos.x,
	position_dy: this._telemetry.currpos.y - this._telemetry.lastpos.y,
	position_dz: this._telemetry.currpos.z - this._telemetry.lastpos.z
      };
      if (clean === true){
	this.cleanTelemetry();
      }
      return d;
    },

    cleanTelemetry:function(){
      this._telemetry.lastpos.x = this._telemetry.currpos.x;
      this._telemetry.lastpos.y = this._telemetry.currpos.y;
      this._telemetry.lastpos.z = this._telemetry.currpos.z;
    },

    telemetryDirty:function(){
      return (this._telemetry.lastpos.x !== this._telemetry.currpos.x ||
	      this._telemetry.lastpos.y !== this._telemetry.currpos.y ||
	      this._telemetry.lastpos.z !== this._telemetry.currpos.z);
    },

    init:function(){
      this.__RotDirty = false;
      this.__FacingDirty = false;
      this._delta = 0.0;
      this._telemetry = {
	lastpos:{x:0.0, y:0.0, z:0.0},
	currpos:{x:0.0, y:0.0, z:0.0}
      };
      (function(self){
	// initalizing telemetry.
	var pos = self.el.getAttribute("position");
	self.setTelemetry(pos.x, pos.y, pos.z, true);

	// Appending the "visitor body" to the user :)
	var d = document.createElement("div");
	d.innerHTML = VISITOR_TEMPL.body;
	var children = Array.prototype.slice.call(d.children);
	children.forEach(function(n){
	  self.el.appendChild(n);
	});
      })(this);

      var ignorePositionChange = false;
      this.__HANDLER_Telemetry = (function(t){
	if (t.visitor_id === this.data.v_id){

	  this.setTelemetry(t.position_x, t.position_y, t.position_z, true);
	  ignorePositionChange = true;
	  this.el.setAttribute("position", this.getTelemetry());
	}
      }).bind(this);      
      REALM.Emitter.on("telemetry", this.__HANDLER_Telemetry);

      var cam_el = this.getCameraElement();
      cam_el.addEventListener('componentchanged', (function (evt) {
	if (evt.detail.name === "rotation"){
	  var ndata = evt.detail.newData;
	  var drot = 0;
	  if (ndata.y > 160){
	    drot = ndata.y - 160;
	  } else if (ndata.y < -160) {
	    drot = ndata.y + 160;
	  }
	  this.__FacingDirty = true;
	  if (drot !== 0){
	    var rot = this.el.getAttribute("rotation");
	    rot.y += drot;
	    cam_el.setAttribute("rotation", {
	      x: ndata.x,
	      y: ndata.y - drot,
	      z: ndata.z
	    });
	    this.el.setAttribute("rotation", rot);
	    this.__RotDirty = true;
	  }
	}
      }).bind(this));

      this.el.addEventListener('componentchanged', (function (evt) {
	if (evt.detail.name === "position"){
	  var ndata = evt.detail.newData;
	  if (ignorePositionChange === false){
	    this.setTelemetry(ndata.x, ndata.y, ndata.z);
	  }
	  ignorePositionChange = false;
	}
      }).bind(this));
    },

    tick:function(timestamp, delta){
      this._delta += (delta/1000); // Storing delta in seconds.
      if (this._delta >= this.data.mindelta){
	this._delta %= this.data.mindelta;
	if (this.telemetryDirty() === true){
	  var pdelta = this.getTelemetryDelta(true);
	  REALM.Server.send("visitor_move", pdelta);
	}
	if (this.__RotDirty === true || this.__FacingDirty === true){
	  var orientation = {};
	  if (this.__RotDirty === true){
	    var rot = this.el.getAttribute("rotation");
	    orientation.rotation_x = rot.x;
	    orientation.rotation_y = rot.y;
	    orientation.rotation_z = rot.z;
	    this.__RotDirty = false;
	  }

	  if (this.__FacingDirty === true){
	    var cam_el = this.getCameraElement();
	    var facing = cam_el.getAttribute("rotation");
	    orientation.facing_x = facing.x;
	    orientation.facing_y = facing.y;
	    orientation.facing_z = facing.z;
	    this.__FacingDirty = false;
	  }
	  REALM.Server.send("visitor_orientation", orientation);
	}
      }
    },

    update:function(oldData){
      console.log(oldData);
    },

    remove:function(){
      REALM.Emitter.unlisten("telemetry", this.__HANDLER_Telemetry);
    }
  });
  
})(window.REALM);
