
var Promise = require('bluebird');
var sinon = require('sinon');
var chai = require('chai');
var aemitter = require('../server/mediator/aemitter');

var assert = chai.assert;
var expect = chai.expect;

describe("Testing server/mediator/aemitter.js", function(){
  /*var sandbox = null;
  beforeEach(function(){
    sandbox = sinon.sandbox.create();
  });

  afterEach(function(){
    sandbox.restore();
    sandbox = null;
  });*/

  // Setting up for tests!
  var emitter = new aemitter();
  var EVENT_ONE = "event_one";
  var EVENT_TWO = "event_two";
  
  // Setting up two seperate event callbacks (repeatable)
  var repeatable_cb1 = sinon.spy();
  var repeatable_cb2 = sinon.spy();

  emitter.on(EVENT_ONE, repeatable_cb1);
  emitter.on(EVENT_TWO, repeatable_cb2);

  // setting up two seperate event callbacks (one-offs).
  var once_cb1 = sinon.spy();
  var once_cb2 = sinon.spy();

  // Set callbacks to be called only once then removed from emitter.
  // These should both be equivolent calls.
  emitter.once(EVENT_ONE, once_cb1);
  emitter.on(EVENT_TWO, once_cb2, null, true);


  describe(".emit(\"event_one\")", function(){

    it("\"Event One\" repeatable callback was called.", function(){
      return emitter.emit("event_one").then(function(){
	expect(repeatable_cb1.called).to.equal(true);
	expect(repeatable_cb1.callCount).to.equal(1);
      });
    });

    it ("\"Event One\" once callback was called.", function(){
      expect(once_cb1.called).to.equal(true);
      expect(once_cb1.callCount).to.equal(1);
    });

    it("\"Event Two\" callbacks were NOT called.", function(){
      expect(repeatable_cb2.called).to.equal(false);
      expect(once_cb2.called).to.equal(false);
    });
  });

  describe(".emit(\"event_two\")", function(){
    it("\"Event Two\" repeatable callback was called.", function(){
      return emitter.emit("event_two").then(function(){
	expect(repeatable_cb2.called).to.equal(true);
	expect(repeatable_cb2.callCount).to.equal(1);
      });
    });

    it ("\"Event Two\" once callback was called.", function(){
      expect(once_cb2.called).to.equal(true);
      expect(once_cb2.callCount).to.equal(1);
    });

    it("\"Event One\" callbacks were NOT called.", function(){
      expect(repeatable_cb1.callCount).to.equal(1);
      expect(once_cb2.callCount).to.equal(1);
    });
  });

  describe(".emit() - None of the once callbacks should trigger.", function(){
    it("Testing against \"" + EVENT_ONE + "\"", function(){
      return emitter.emit(EVENT_ONE).then(function(){
	expect(once_cb1.callCount).to.equal(1);
      });
    });
    
    it("Testing against \"" + EVENT_TWO + "\"", function(){
      return emitter.emit(EVENT_TWO).then(function(){
	expect(once_cb2.callCount).to.equal(1);
      });
    });

    it("Repeatable callbacks were triggered.", function(){
      expect(repeatable_cb1.callCount).to.equal(2);
      expect(repeatable_cb2.callCount).to.equal(2);
    });
  });

  describe(".emit() - Argument passing.", function(){
    var arg = {some:"value"};
    it("Verify {some:\"value\"} was passed to callback.", function(){
      return emitter.emit(EVENT_ONE, arg).then(function(){
	expect(repeatable_cb1.calledWith(arg)).to.equal(true);
      });
    });
  });

  describe(".remove(\"" + EVENT_TWO + "\", repeatable_callback)", function(){
    it("\"" + EVENT_TWO + "\" callback no longer triggers (removed).", function(){
      emitter.remove(EVENT_TWO, repeatable_cb2);
      return emitter.emit(EVENT_TWO).then(function(){
	expect(repeatable_cb2.callCount).to.equal(2);
      });
    });
  });

  describe(".clear(\"" + EVENT_ONE + "\")", function(){
    it("\"" + EVENT_ONE + "\" callback no longer triggers (removed).", function(){
      emitter.clear(EVENT_ONE);
      return emitter.emit(EVENT_ONE).then(function(){
	expect(repeatable_cb1.callCount).to.equal(3); // Was called a third time during the argument passing test.
      });
    });
  });
});
