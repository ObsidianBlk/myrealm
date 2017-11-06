
module.exports = function(REALM, vu){

  function CreateTelemetry(sx, sy, sz){
    var t={};
    var x = ((typeof(sx) === 'number' || typeof(sx) === 'string') ? Number(sx) : 0);
    var y = ((typeof(sy) === 'number' || typeof(sy) === 'string') ? Number(sy) : 0);
    var z = ((typeof(sz) === 'number' || typeof(sz) === 'string') ? Number(sz) : 0);
    var lx = x;
    var ly = y;
    var lz = z;
    
    Object.defineProperties(t, {
      "x":{
	enumerable: true,
	get:function(){return x;},
	set:function(nx){
	  lx = x;
	  x = nx;
	}
      },

      "y":{
	enumerable: true,
	get:function(){return y;},
	set:function(ny){
	  ly = y;
	  y = ny;
	}
      },

      "z":{
	enumberable: true,
	get:function(){return z;},
	set:function(nz){
	  lz = z;
	  z = nz;
	}
      },

      "dirty":{
	enumberable: true,
	get:function(){
	  return (x != lx || y != ly || z != lz);
	}
      },
      
      "set":{
	enumerable: true,
	writable: false,
	configurable: false,
	value: function(nx, ny, nz, clean){
	  if (clean !== true){
	    lx = x;
	    ly = y;
	    lz = z;
	  }
	  x = ((typeof(nx) === 'number' || typeof(nx) === 'string') ? Number(nx) : 0);
	  y = ((typeof(ny) === 'number' || typeof(ny) === 'string') ? Number(ny) : 0);
	  z = ((typeof(nz) === 'number' || typeof(nz) === 'string') ? Number(nz) : 0);
	  if (clean === true){
	    lx = x;
	    ly = y;
	    lz = z;
	  }
	}
      },

      "get":{
	enumerable: true,
	writable: false,
	configurable: false,
	value: function(){
	  return {x:x, y:y, z:z};
	}
      },

      "delta":{
	enumerable: true,
	writable: false,
	configurable: false,
	value: function(clean){
	  var d = {
	    x: x - lx,
	    y: y - ly,
	    z: z - lz
	  };
	  if (clean === true){
	    lx = x;
	    ly = y;
	    lz = z;
	  }
	  return d;
	}
      },

      "clean":{
	enumerable: true,
	writable: false,
	configurable: false,
	value:function(){
	  lx = x;
	  ly = y;
	  lz = z;
	}
      }
    });

    return t;
  }
  
  REALM.Emitter.on("connected", function(data){
    var attach = false;
    var selfe = document.querySelector("#self");
    if (selfe === null){
      selfe = document.createElement("a-visitor-self");
      selfe.setAttribute("id", "self");
      attach = true;
    }
    selfe.setAttribute("v-id", data.id);
    selfe.setAttribute("username", data.username);
    if (typeof(data.body_template) === 'string'){
      selfe.setAttribute("body-template", data.body_template);
    }
    if (vu.isMobile === true){
      selfe.setAttribute("wasd-controls-enabled", false);
      selfe.setAttribute("touch-move-controls-enabled", true);
    } else {
      selfe.setAttribute("wasd-controls-enabled", true);
      selfe.setAttribute("touch-move-controls-enabled", false);
    }
    
    if (attach === true){
      var scene = vu.getScene();
      scene.appendChild(selfe);
    }
    REALM.Server.send("visitor_list"); // Request a list of already connected visitors. (results will come in as "visitor_enter" events).
  });


  // -------------
  // --- <visitor_self> Component definition!
  REALM.AFRAME.registerComponent("visitor_self", {
    dependencies:['visitor_body', 'camera'],
    
    schema:{
      v_id:{default: "000"},
      username:{default:"visitor"},
      mindelta:{default:0.1}
    },


    getUserHeight:function(){
      return this.el.components.camera.data.userHeight;
      //var camera = this.getCameraComponent();
      //return (camera) ? camera.userHeight : 0;
    },

    angleYFromBody:function(fy){
      var brot = this._body.getAttribute("rotation");
      return fy - brot.y;
    },

    init:function(){
      this.__RotDirty = false;
      this.__FacingDirty = false;
      this.__FacingOld = null;
      this._timeDelta = 0;
      this._telemetry = CreateTelemetry();
      this._vbc = this.el.components.visitor_body;

      /*
      (function(self){
	// initalizing telemetry.
	var pos = self.el.getAttribute("position");
	self.setTelemetry(pos.x, pos.y, pos.z, true);

	// Appending the "visitor body" to the scene :)
        var scene = SCENE();
	var d = document.createElement("div");
	d.innerHTML = VISITOR_TEMPL.body;
        if (d.children.length !== 1){
          throw new Error("Template contains incorrect number of children! Expected 1.");
        }
        d.children[0].setAttribute("id", self.data.v_id + "_BODY");
        self._body = d.children[0];
	scene.appendChild(self._body);
      })(this);
      */

      
      //var ignorePositionChange = false;
      this.__HANDLER_Telemetry = (function(t){
        console.log(t);
	if (t.visitor_id === this.data.v_id){
	  this._telemetry.set(t.telemetry.position.x, t.telemetry.position.y, t.telemetry.position.z, true);
	  //ignorePositionChange = true;
          var tel = this._telemetry.get();
          this._vbc.setBodyPosition(tel);
          tel.y += this.getUserHeight();
	  this.el.setAttribute("position", tel);
	}
      }).bind(this);      
      REALM.Emitter.once("telemetry", this.__HANDLER_Telemetry);
      

      this.el.addEventListener('componentchanged', (function (evt) {
        var ndata = evt.detail.newData;
        switch (evt.detail.name) {
        case "position":
	  this._telemetry.set(ndata.x, ndata.y - this.getUserHeight(), ndata.z);
          this._vbc.setBodyPosition({x:ndata.x, y:ndata.y-this.getUserHeight(), z:ndata.z});

	  // Set the body Y rotation to match the head Y rotation if moving.
	  var hrot = this.el.getAttribute("rotation");
	  var brot = this._vbc.getBodyRotation();
	  if (brot.y !== hrot.y){
	    brot.y = hrot.y;
	    this._vbc.setBodyRotation(brot);
	    this.__RotDirty = true;
	  }
          break;
	case "rotation":
          var dof = 80.0; // Degree of freedom +/- at which to turn the body.
	  if (this.__FacingOld === null){
	    this.__FacingOld = {x:0, y:0, z:0};
	  }
          var fdelta = (function(odata){
            var v = new REALM.THREE.Vector3(
              ndata.x - odata.x,
              ndata.y - odata.y,
              ndata.z - odata.z
            );
            return v.length();
          })(this.__FacingOld);

          if (fdelta > 0.25){
	    this.__FacingDirty = true;

	    var rot = this._vbc.getBodyRotation();
            var afb = ndata.y - rot.y;
	    // If the disparity of the body and head rotation is greater than 180 user is strattling the
	    // the 360 - 0 rotational boundry... adjust for that.
	    if (Math.abs(ndata.y - rot.y) > 180){
	      if (ndata.y > rot.y){
		afb = (ndata.y - 360) - rot.y;
	      } else {
		afb = (ndata.y + 360) - rot.y;
	      }
	    }
	    // Now we can update the old facing value.
	    this.__FacingOld = ndata;

	    if (Math.abs(afb) > dof){
	      rot.y += ((afb > 0) ? afb - dof : afb + dof);
	      if (rot.y < 0){
		rot.y += 360;
	      } else if (rot.y > 360){
		rot.y %= 360;
	      }
	      this._vbc.setBodyRotation(rot);
	      this.__RotDirty = true;
	    }
	  }
          break;
        }
      }).bind(this));
    },

    tick:function(timestamp, delta){
      this._timeDelta += (delta/1000); // Storing delta in seconds.
      if (this._timeDelta >= this.data.mindelta){
	this._timeDelta %= this.data.mindelta;
	if (this._telemetry.dirty === true || this.__RotDirty === true || this.__FacingDirty === true){
	  var telemetry = {};
	  if (this._telemetry.dirty === true){
	    telemetry.position = this._telemetry.get();
	    this._telemetry.clean();
	  }
	  
	  if (this.__RotDirty === true){
	    telemetry.rotation = this._vbc.getBodyRotation();
	    this.__RotDirty = false;
	  }

	  if (this.__FacingDirty === true){
	    telemetry.facing = this.el.getAttribute("rotation");
	    this.__FacingDirty = false;
	  }
	  REALM.Server.send("telemetry", telemetry);
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



  // -------------
  // --- <a-visitor-self> Primitive definition!
  REALM.AFRAME.registerPrimitive("a-visitor-self", {
    defaultComponents: {
      camera:{
	userHeight: 1.6
      },
      visitor_body: {
	head_visible: false,
	body_template: "default",
	body_visible: true,
	body_detached: true
      },
      visitor_self: {
	v_id: "0",
	username: "Visitor",
	mindelta: 0.1
      },
      'wasd-controls':{
	enabled: false
      },
      'touch-move-controls':{
	enabled:false
      },
      'look-controls-alt':{}
    },

    mappings: {
      'body-template': 'visitor_body.body_template',
      'v-id': 'visitor_self.v_id',
      username: 'visitor_self.username',
      mindelta: 'visitor_self.mindelta',
      far: 'camera.far',
      fov: 'camera.fov',
      near: 'camera.near',
      userHeight: 'camera.userHeight',
      zoom: 'camera.zoom',
      'wasd-controls-enabled':'wasd-controls.enabled',
      'touch-move-controls-enabled':'touch-move-controls.enabled'
    }
  });
};
