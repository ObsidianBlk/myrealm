
var Promise = require('bluebird');
var sinon = require('sinon');
var chai = require('chai');
var Middleware = require('../server/middleware/middleware');

var assert = chai.assert;
var expect = chai.expect;

describe("Testing server/middleware/middleware.js", function(){

  // middleware definitions (wrapped in sinon.spy)
  var addOne = sinon.spy(function(ctx, next){
    ctx.val += 1;
    next();
  });

  var addTwo = sinon.spy(function(ctx, next){
    ctx.val += 2;
    next();
  });

  var divThree = sinon.spy(function(ctx, next){
    ctx.val /= 2;
    next();
  });

  var thrower = sinon.spy(function(ctx, next){
    throw new Error("This is a random exception!");
  });

  
  describe("Testing two function middleware", function(){
    var mw = new Middleware();
    mw.use(addOne);
    mw.use(addTwo);

    it("Generates expected value.", function(){
      return mw.exec({val: 3}).then(function(ctx){
	expect(ctx.val).to.equal(6);
      });
    });

    it("All functions called.", function(){
      expect(addOne.called && addTwo.called).to.equal(true);
    });

    it("Functions called in order", function(){
      expect(addOne.calledBefore(addTwo)).to.equal(true);
    });
  });

  describe("Testing three function middleware", function(){
    var mw = new Middleware();
    mw.use(addOne);
    mw.use(addTwo);
    mw.use(divThree);

    it("Generates expected value.", function(){
      // Reset the states for these spies :)
      addOne.reset();
      addTwo.reset();
      divThree.reset();

      return mw.exec({val: 3}).then(function(ctx){
	expect(ctx.val).to.equal(3);
      });
    });

    it("All functions called.", function(){
      expect(addOne.called && addTwo.called && divThree.called).to.equal(true);
    });

    it("Functions called in order", function(){
      expect(addOne.calledBefore(addTwo)).to.equal(true);
      expect(addTwo.calledBefore(divThree)).to.equal(true);
    });
  });

  describe("Testing four function middleware.\nDefined with combination function array and call chaining.\nFirst and last function the same.", function(){
    var mw = new Middleware();
    mw.use([addOne, addTwo]).use([divThree, addOne]);

    it("Generates expected value.", function(){
      // Reset the states for these spies :)
      addOne.reset();
      addTwo.reset();
      divThree.reset();

      return mw.exec({val: 3}).then(function(ctx){
	expect(ctx.val).to.equal(4);
      });
    });

    it("All functions called.", function(){
      expect(addOne.called && addTwo.called && divThree.called).to.equal(true);
    });

    it("First function called twice.", function(){
      expect(addOne.callCount).to.equal(2);
    });

    it("Functions called in order", function(){
      expect(addTwo.calledAfter(addOne)).to.equal(true);
      expect(divThree.calledAfter(addTwo)).to.equal(true);
      expect(addOne.calledAfter(divThree)).to.equal(true);
    });
  });

  describe("Testing exception handling (3 funcs, 2nd func throws exception)", function(){
    var mw = new Middleware();
    
    mw.use(addOne);
    mw.use(thrower);
    mw.use(addTwo);

    it("Catches exception thrown by second function.", function(){
      // Reset the states for these spies :)
      addOne.reset();
      addTwo.reset();
      divThree.reset();
      
      return mw.exec({val: 3}).then(function(ctx){
	assert.fail("Exception expected.");
      }, function(err){
	expect(thrower.threw()).to.equal(true);
      });
    });

    it("First function WAS called.", function(){
      expect(addOne.called).to.equal(true);
    });

    it("Third function was NOT called.", function(){
      expect(addTwo.called).to.equal(false);
    });
  });
  
});
