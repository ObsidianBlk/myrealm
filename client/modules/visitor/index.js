
if (typeof(window.REALM) === 'undefined'){
  throw new Error("REALM object missing.");
}


(function(REALM){

  var isMobile = REALM.AFRAME.utils.device.isMobile();
  var isGearVR = REALM.AFRAME.utils.device.isGearVR();
  var vu = {}; // vu = Visitor Utilities

  var HEAD_TEMPLATE_BASE_NAME = "tmpl_visitor_head_";
  var BODY_TEMPLATE_BASE_NAME = "tmpl_visitor_body_";
  var headTemplates = null;
  var bodyTemplates = null;

  function FindTemplates(baseName){
    var el = document.querySelectorAll("[id^='" + baseName + "']");
    var res = null;
    if (el !== null){
      el.forEach(function(e){
	if (e.nodeType === 1 /*ELEMENT_NODE*/ && e.name === "script"){
	  var id = e.getAttribute("id");
	  if (id.length > baseName.length && e.innerHTML.length > 0){
	    if (res === null){
	      res = [];
	    }
	    res.push({
	      name: id.substring(baseName.length),
	      html: e.innerHTML
	    });
	  }
	}
      });
    }
    return res;
  }


  Object.defineProperties(vu, {
    "isMobile":{
      enumberable: true,
      writable: false,
      configurable: false,
      value: isMobile
    },

    "isGearVR":{
      enumberable: true,
      writable: false,
      configurable: false,
      value: isGearVR
    },

    "isHeadsetConnected":{
      enumberable: true,
      get:function(){
	return REALM.AFRAME.utils.device.checkHeadsetConnected();
      }
    },

    "hasPositionTracking":{
      enumberable: true,
      get:function(){
	return REALM.AFRAME.utils.device.checkHasPositionalTracking();
      }
    },

    "headTemplates":{
      enumerable: true,
      get:function(){
	if (headTemplates === null){
	  headTemplates = FindTemplates(HEAD_TEMPLATE_BASE_NAME);
	}
	return (headTemplates !== null) ? headTemplates : [];
      }
    },

    "bodyTemplates":{
      enumerable: true,
      get:function(){
	if (bodyTemplates === null){
	  bodyTemplates = FindTemplates(BODY_TEMPLATE_BASE_NAME);
	}
	return (bodyTemplates !== null) ? bodyTemplates : [];
      }
    }
  });

  vu.getScene = (function(){
    var scene = null;
    return function(){
      if (scene === null){
	var s = document.getElementsByTagName("a-scene");
	scene = (s.length > 0) ? s[0] : null;
      }
      return scene;
    };
  })();

  vu.getHeadTemplate = function(name){
    if (vu.headTemplates.length > 0){
      for (var i=0; i < headTemplates.length; i++){
	if (headTemplates[i].name === name){
	  return headTemplates[i].html;
	}
      }
    }
    return "";
  };

  vu.getBodyTemplate = function(name){
    if (vu.bodyTemplates.length > 0){
      for (var i=0; i < bodyTemplates.length; i++){
	if (bodyTemplates[i].name === name){
	  return bodyTemplates[i].html;
	}
      }
    }
    return "";
  };


  // Now we bring in the Visitor components. YAY!
  require("./visitor_body")(REALM, vu);
  require("./visitor_other")(REALM, vu);
  require("./visitor_self")(REALM, vu);

})(window.REALM);
