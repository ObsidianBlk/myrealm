
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

    it("Functions called in order", function(){
      expect(addOne.calledBefore(addTwo)).to.equal(true);
    });
  });
  
});
