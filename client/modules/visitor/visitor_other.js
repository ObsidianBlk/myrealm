
module.exports = function(REALM, vu){

  function AddNewVisitor(data){
    var scene = vu.getScene();

    console.log("NEW VISITOR!");
    console.log(data);

    var t = data.telemetry;

    var el = document.querySelector("#" + data.visitor_id);
    if (el === null){ // Don't re-add a visitor already being tracked.
      el = document.createElement("a-visitor-other");
      /*var visdef = "v_id:" + data.visitor_id + ";username:Visitor_" + data.visitor_id;
      var visbodydef = "";
      if (typeof(data.body_template) === 'string'){
	visbodydef += "body_template=" + data.body_template;
      }
      if (typeof(data.head_template) === 'string'){
	if (visbodydef !== ""){
	  visbodydef += ";";
	}
	visbodydef += "head_template=" + data.head_template;
      }*/
      
      el.setAttribute("id", data.visitor_id);
      el.setAttribute("v-id", data.visitor_id);
      el.setAttribute("username", data.username);
      if (typeof(data.body_template) === 'string'){
	el.setAttribute("body-template", data.body_template);
      }
      if (typeof(data.head_template) === 'string'){
	el.setAttribute("head-template", data.head_template);
      }
      //el.setAttribute("visitor_body", visbodydef);
      //el.setAttribute("visitor_other", visdef);
      el.setAttribute("position", t.position.x + " " + t.position.y + " " + t.position.z);
      scene.appendChild(el);
    }
  }
  

  REALM.Emitter.on("visitor_enter", function(data){
    console.log(data);
    AddNewVisitor(data);
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

  REALM.Emitter.on("visitor_list", function(data, msg){
    console.log(msg);
    data.forEach(function(visitor){
      AddNewVisitor(visitor);
    });
  });



  // -------------
  // --- <visitor_other> Component definition!
  REALM.AFRAME.registerComponent("visitor_other", {
    dependencies:['visitor_body'],
    
    schema:{
      v_id:{default: "0"},
      username:{default:"visitor"}
    },

    init: function(){
      var vbc = this.el.components.visitor_body;
      this.__HANDLER_Telemetry = (function(t){
	if (t.visitor_id === this.data.v_id){
	  var telemetry = t.telemetry;
	  if (telemetry.hasOwnProperty("position") === true){
	    this.el.setAttribute("position", telemetry.position);
	  }

	  if (telemetry.hasOwnProperty("rotation") === true){
	    vbc.setBodyRotation(telemetry.rotation);
	  }

	  if (telemetry.hasOwnProperty("facing") === true){
	    vbc.setHeadRotation(telemetry.facing);
	  }
	}
      }).bind(this);
      
      REALM.Emitter.on("telemetry", this.__HANDLER_Telemetry);
    }
  });



  // -------------
  // --- <a-visitor-other> Primitive definition!
  REALM.AFRAME.registerPrimitive("a-visitor-other", {
    defaultComponents: {
      visitor_body: {
	head_template: "default",
	head_visible: true,
	body_template: "default",
	body_visible: true
      },
      visitor_other: {
	v_id: "0",
	username: "Visitor"
      }
    },

    mappings: {
      'head-template': 'visitor_body.head_template',
      'body-template': 'visitor_body.body_template',
      'v-id': 'visitor_other.v_id',
      username: 'visitor_other.username'
    }
  });
};
