
var Promise = require('bluebird');
var sinon = require('sinon');
var chai = require('chai');
var arequester = require('../server/mediator/arequester');

var expect = chai.expect;

describe("Testing server/mediator/arequester.js", function(){
  var requester = new arequester();

  describe(".define()", function(){
    it("Verify requester has no currently defined functions.", function(){
      expect(requester.count).to.equal(0);
    });

    it("Define a function (test.addVals).", function(){
      requester.define("test.addVals", function(a, b){
	return a+b;
      });
      expect(requester.count).to.equal(1);
    });

    it("Define three functions (test.subVals, test.multVals, and test.divVals).", function(){
      requester.define("test.subVals", function(a, b){
	return a-b;
      });

      requester.define("test.multVals", function(a, b){
	return a*b;
      });

      requester.define("test.divVals", function(a, b){
	if (b === 0){
	  return Number.NaN;
	}
	return a/b;
      });

      expect(requester.count).to.equal(4);
    });

    it("Verify defined namespaces.", function(){
      expect(requester.requestList).to.have.same.members([
        "test",
	"test.addVals",
	"test.multVals",
	"test.subVals",
	"test.divVals"
      ]);
    });
  });

  describe(".request()", function(){
    it("Calling test.addVals(1, 2) ... should return 3.", function(){
      return requester.request("test.addVals", 1, 2).then(function(val){
	expect(val).to.equal(3);
      });
    });

    it("Chain calling to preform (((1+2)*5)-3)/6 ... should return 2.", function(){
      return requester.request("test.addVals", 1, 2).then(function(val){
	return requester.request("test.multVals", val, 5);
      }).then(function(val){
	return requester.request("test.subVals", val, 3);
      }).then(function(val){
	return requester.request("test.divVals", val, 6);
      }).then(function(val){
	expect(val).to.equal(2);
      });
    });
  });
});


