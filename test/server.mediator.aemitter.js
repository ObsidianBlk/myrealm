
var sinon = require('sinon');
var chai = require('chai');
var aemitter = require('../server/mediator/aemitter');

define("Testing server/mediator/aemitter.js", function(){
  var sandbox = null;
  beforeEach(function(){
    sandbox = sinon.sandbox.create();
  });

  afterEach(function(){
    sandbox.restore();
    sandbox = null;
  });

  // Setting up for tests!
  var emitter = new aemitter();
  
  // Setting up two seperate event callbacks (repeatable)
  var repeatable_cb1 = sinon.spy();
  var repeatable_cb2 = sinon.spy();

  emitter.on("event_one", repeatable_cb1);
  emitter.on("event_two", repeatable_cb2);

  // setting up two seperate event callbacks (one-offs).
  var once_cb1 = sinon.spy();
  var once_cb2 = sinon.spy();

  emitter.once("event_one", once_cb1);
  emitter.on("event_two", once_cb2, null, true);

  // Actual tests
  // TODO: Finish this later

});
