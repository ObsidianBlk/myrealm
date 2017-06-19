if (typeof(window.REALM) === 'undefined'){
  throw new Error("REALM object missing.");
}


/*
-----------------------------------------------------------------------------------------
This components is an almost direct copy of the look-controls component that comes
with A-Frame 0.5.0 (current dev version at time of coding).

Default look-control component treated rotation values different between HDM/Mobile Sendor
input and desktop mouse movement input. This is an attempt to unify the rotational values
between the two mechanisms without altering the core operation of the component itself.

All credit for the original look-controls A-Frame component goes to it's original authors!!
-----------------------------------------------------------------------------------------
*/
(function(THREE, AFRAME){

  var registerComponent = AFRAME.registerComponent;
  var isMobile = AFRAME.utils.device.isMobile();
  var bind = function(func, owner){
    return func.bind(owner);
  };

  var CLAMP_VELOCITY = 0.00001;
  var MAX_DELTA = 0.2;


  registerComponent("touch-move-controls", {
    schema: {
      maxAcceleration: {default: 65},
      inverted: {default: false},
      easing: {default: 20},
      enabled: {default: true},
      fly: {default: false}
    },

    init: function () {
      this.touchInfo={
	startX:0,
	startY:0,
	lastX:0,
	lastY:0,
	enabled:false
      };
      
      this.velocity = new THREE.Vector3();

      // Bind methods and add event listeners.
      this.onBlur = bind(this.onBlur, this);
      this.onFocus = bind(this.onFocus, this);
      this.onTouchStart = bind(this.onTouchStart, this);
      this.onTouchMove = bind(this.onTouchMove, this);
      this.onTouchEnd = bind(this.onTouchEnd, this);
      this.onVisibilityChange = bind(this.onVisibilityChange, this);
      this.attachVisibilityEventListeners();
    },

    tick: function (time, delta) {
      var data = this.data;
      var el = this.el;
      var velocity = this.velocity;

      // Use seconds.
      delta = delta / 1000;

      // Get velocity.
      this.updateVelocity(delta);
      if (velocity.z === 0) { return; }

      // Get movement vector and translate position.
      var movementVector = this.getMovementVector(delta);
      var position = el.getAttribute('position');
      el.setAttribute('position', {
	x: position.x + movementVector.x,
	y: position.y + movementVector.y,
	z: position.z + movementVector.z
      });
    },

    remove: function () {
      this.removeTouchEventListeners();
      this.removeVisibilityEventListeners();
    },

    play: function () {
      this.attachTouchEventListeners();
    },

    pause: function () {
      this.removeTouchEventListeners();
    },

    updateVelocity: function (delta) {
      var data = this.data;
      var velocity = this.velocity;

      // If FPS too low, reset velocity.
      if (delta > MAX_DELTA) {
	velocity.z = 0;
	return;
      }

      // Decay velocity.
      if (velocity.z !== 0) {
	velocity.z -= velocity.z * data.easing * delta;
      }

      // Clamp velocity easing.
      if (Math.abs(velocity.z) < CLAMP_VELOCITY) { velocity.z = 0; }

      if (!data.enabled) { return; }

      // Update velocity using keys pressed.
      var acceleration = this.getAcceleration();
      var sign = data.inverted ? -1 : 1;
      velocity.z += sign * acceleration * delta;
    },

    getAcceleration: function(){
      if (this.data.enabled === false || this.touchInfo.enabled === false){return 0;}
      return ((this.touchInfo.lastY - this.touchInfo.startY)/this.el.sceneEl.canvas.clientHeight) * this.data.maxAcceleration;
    },

    getMovementVector: (function () {
      var directionVector = new THREE.Vector3(0, 0, 0);
      var rotationEuler = new THREE.Euler(0, 0, 0, 'YXZ');

      return function (delta) {
	var rotation = this.el.getAttribute('rotation');
	var velocity = this.velocity;

	directionVector.copy(velocity);
	directionVector.multiplyScalar(delta);

	// Absolute.
	if (!rotation) { return directionVector; }

	if (!this.data.fly) { rotation.x = 0; }

	// Transform direction relative to heading.
	rotationEuler.set(THREE.Math.degToRad(rotation.x), THREE.Math.degToRad(rotation.y), 0);
	directionVector.applyEuler(rotationEuler);
	return directionVector;
      };
    })(),

    attachVisibilityEventListeners: function () {
      window.addEventListener('blur', this.onBlur);
      window.addEventListener('focus', this.onFocus);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    },

    removeVisibilityEventListeners: function () {
      window.removeEventListener('blur', this.onBlur);
      window.removeEventListener('focus', this.onFocus);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    },

    attachTouchEventListeners: function () {
      var sceneEl = this.el.sceneEl;

      var enableTouchListeners = (function(){
	var canvasEl = sceneEl.canvas;
	canvasEl.addEventListener('touchstart', this.onTouchStart);
	canvasEl.addEventListener('touchmove', this.onTouchMove);
	canvasEl.addEventListener('touchend', this.onTouchEnd);
      }).bind(this);

      if (!sceneEl.canvas) {
	sceneEl.addEventListener('render-target-loaded', enableTouchListeners);
      } else {
	enableTouchListeners();
      }
    },

    removeTouchEventListeners: function () {
      var sceneEl = this.el.sceneEl;
      var canvasEl = sceneEl && sceneEl.canvas;
      if (!canvasEl) { return; }
      
      canvasEl.removeEventListener('touchstart', this.onTouchStart);
      canvasEl.removeEventListener('touchmove', this.onTouchMove);
      canvasEl.removeEventListener('touchend', this.onTouchEnd);
    },

    onVisibilityChange: function () {
      if (document.hidden) {
	this.onBlur();
      } else {
	this.onFocus();
      }
    },

    onBlur: function () {
      this.pause();
    },

    onFocus: function () {
      this.play();
    },

    onTouchStart: function (e) {
      if (e.touches.length !== 1) { return; }
      this.touchInfo.startX = e.touches[0].pageX;
      this.touchInfo.startY = e.touches[0].pageY;
      this.touchInfo.enabled = true;
    },

    onTouchMove: function (e) {
      if (!this.touchInfo.enabled) { return; }
      this.touchInfo.lastX = e.touches[0].pageX;
      this.touchInfo.lastY = e.touches[0].pageY;
    },

    onTouchEnd: function () {
      this.touchInfo.enabled = false;
    }
  });

})(window.REALM.THREE, window.REALM.AFRAME);
