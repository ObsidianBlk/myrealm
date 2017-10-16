
module.exports = function(REALM, vu){

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

  function CreateBasicBody(el){
    var body = document.createElement("a-entity");
    body.setAttribute("class", "visitor_body");

    var e = document.createElement("a-entity");
    e.setAttribute("geometry", "primitive: box; width: 0.5; height: 1.1; depth: 0.5");
    e.setAttribute("material", "color:#FFFF00");
    e.setAttribute("position", "0 0.55 0");
    body.appendChild(e);

    //<a-entity geometry="primitive: box; width: 0.5; height: 0.1; depth: 0.1" material="color:#999900" position="0 0.05 -0.3"></a-entity>
    e = document.createElement("a-entity");
    e.setAttribute("geometry", "primitive: box; width: 0.5; height: 0.1; depth: 0.1");
    e.setAttribute("material", "color:#999900");
    e.setAttribute("position", "0 0.05 -0.3");
    body.appendChild(e);

    el.appendChild(body);
    return body;
  }
  
  REALM.AFRAME.registerComponent("visitor_body", {
    schema:{
      head_template: {default:""},
      body_template: {default:""}
    },

    init: function(){
      this.bodyEl = null;
      this.headEl = null;

      // TODO: Well... actually name this do something would be a start, I suppose.
    }
  });
};
