
module.exports = function(REALM, vu){

  // This function creates a very crude "head", in case no template was given.
  function CreateBasicHead(el){
    var head = document.createElement("a-entity");
    head.setAttribute("class", "visitor_head");

    var e = document.createElement("a-entity");
    e.setAttribute("geometry", "primitive: box; width: 0.8; height: 0.8; depth: 0.8");
    e.setAttribute("material", "color:#AAFF00");
    head.appendChild(e);

    e = document.createElement("a-entity");
    e.setAttribute("geometry", "primitive: box; width: 0.75; height: 0.75; depth: 0.05");
    e.setAttribute("material", "color:black");
    e.setAttribute("position", "0 0 -0.425");
    head.appendChild(e);
    
    el.appendChild(head);
    return head;
  }

  // This function creates a very crude "body", in case no template was given.
  function CreateBasicBody(el){
    var body = document.createElement("a-entity");
    body.setAttribute("class", "visitor_body");

    var e = document.createElement("a-entity");
    e.setAttribute("geometry", "primitive: box; width: 0.5; height: 1.1; depth: 0.5");
    e.setAttribute("material", "color:#FFFF00");
    e.setAttribute("position", "0 0.55 0");
    body.appendChild(e);

    e = document.createElement("a-entity");
    e.setAttribute("geometry", "primitive: box; width: 0.5; height: 0.1; depth: 0.1");
    e.setAttribute("material", "color:#999900");
    e.setAttribute("position", "0 0.05 -0.3");
    body.appendChild(e);

    el.appendChild(body);
    return body;
  }

  function CreateHead(el, template_name){
    if (template_name !== ""){
      var template = vu.getHeadTemplate(template_name);
      if (template !== ""){
	var head = document.createElement("a-entity");
	head.setAttribute("class", "visitor_head");
	head.innerHTML = template;
	return head;
      }
    }
    return CreateBasicHead(el);
  }

  function CreateBody(el, template_name){
    if (template_name !== ""){
      var template = vu.getBodyTemplate(template_name);
      if (template !== ""){
	var body = document.createElement("a-entity");
	body.setAttribute("class", "visitor_body");
	body.innerHTML = template;
	return body;
      }
    }
    return CreateBasicBody(el);
  }
  
  REALM.AFRAME.registerComponent("visitor_body", {
    schema:{
      head_template: {default: ""},
      head_visible: {default: true},
      head_height: {default: 1.6},
      body_template: {default: ""},
      body_visible: {default: true},
      body_detached: {default: false}
    },

    _RemoveBody:function(){
      if (this.bodyEl !== null){
	var parent = this.bodyEl.parent;
	if (typeof(parent) !== 'undefined' && parent !== null){
	  parent.removeChild(this.bodyEl);
	}
	this.bodyEl = null;
      }
    },

    _CreateBody:function(){
      this._RemoveBody();
      if (this.data.body_visible === true){
	this.bodyEl = CreateBody(
	  (this.data.body_detached === true) ? this.el.sceneEl : this.el,
	  this.data.body_template
	);
	if (this.bodyEl !== null && this.data.body_detached === true){
	  this.bodyEl.setAttribute("position", this.el.getAttribute("position"));
	}
      }
    },

    init: function(){
      this.bodyEl = null;
      this.headEl = null;

      this.bodyTargPos = null;
      this.bodyTargRot = null;
      this.headTargRot = null;
    },

    update: function(oldData){
      var bodyRot = (this.bodyEl !== null) ? this.bodyEl.getAttribute("rotation") : {x:0, y:0, z:0};
      var bodyPos = (this.bodyEl !== null) ? this.bodyEl.getAttribute("position") : {x:0, y:0, z:0};
      var headRot = (this.headEl !== null) ? this.headEl.getAttribute("rotation") : {x:0, y:0, z:0};
      
      // ------
      // --- Check on the body first!
      if (this.data.body_visible !== oldData.body_visible || this.data.body_detached !== oldData.body_detached){
	// If visibility is false, this simply clears the body element.
	this._CreateBody();
      } else if (this.data.body_visible === true){
	// Now check template change, but only if the visible state is true
	if (this.data.body_template !== oldData.body_template){
	  this._CreateBody();
	  this.setBodyRotation(bodyRot, true);
	}
      }
      this.setBodyPosition(bodyPos, true);

      // ------
      // --- Check on the head next!
      if (this.data.head_visible !== oldData.head_visible){
	// Visibility has changed. Even without knowing what the new state explicitly is, first remove (if it exists) the current head element.
	if (this.headEl !== null){
	  this.el.removeChild(this.headEl);
	  this.headEl = null;
	}

	// Now, if going visible, attempt to create a new head element.
	if (this.data.head_visible === true){
	  this.headEl = CreateHead(this.el, this.data.head_template);
	  this.setHeadRotation(headRot, true);
	}
      } else if (this.data.head_visible === true){
	// Now check template change, but only if the visible state is true
	if (this.data.head_template !== oldData.head_template){
	  if (this.headEl !== null){ // Remove old head
	    this.el.removeChild(this.headEl);
	    this.headEl = null;
	  }
	  // Add the new head
	  this.headEl = CreateHead(this.el, this.data.head_template);
	  this.setHeadRotation(headRot, true);
	}
      }

      this.updateHeadHeight();
    },

    updateHeadHeight: function(){
      if (this.headEl !== null){
	this.headEl.setAttribute("position", "y", this.data.head_height);
      }
    },

    // r is expected to be of the form {x:<number>, y:<number>, z:<number>}
    setBodyRotation: function(r){
      if (this.bodyEl !== null){
	this.bodyEl.setAttribute("rotation", r);
      }
    },

    getBodyRotation: function(){
      var r = {x:0, y:0, z:0};
      if (this.bodyEl !== null){
	// This returns a freaking reference! WHY! This is confusing as SIN!
	r = this.bodyEl.getAttribute("rotation");
      }
      return {x:r.x, y:r.y, z:r.z};
    },

    setBodyPosition: function(p){
      if (this.bodyEl !== null){
	this.bodyEl.setAttribute("position", p);
      }
    },

    getBodyPosition: function(){
      var p = {x:0, y:0, z:0};
      if (this.bodyEl !== null){
	p = this.bodyEl.getAttribute("position");
      }
      return {x:p.x, y:p.y, z:p.z};
    },

    // r is expected to be of the form {x:<number>, y:<number>, z:<number>}
    setHeadRotation: function(r){
      if (this.headEl !== null){
	this.headEl.setAttribute("rotation", r);
      }
    },

    getHeadRotation: function(){
      var r = {x:0, y:0, z:0};
      if (this.headEl !== null){
	r = this.headEl.getAttribute("rotation");
      }
      return {x:r.x, y:r.y, z:r.z};
    }
  });
};


