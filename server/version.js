/*
IMPORTANT NOTE: most of the code here was borrowed from https://github.com/remy/clite/blob/master/lib/version.js
*/


var path = require('path');
var exec = require('child_process').exec;
var Promise = require('bluebird');


function commit(root) {
  return command('git rev-parse --short HEAD', root);
}

function branch(root) {
  return command('git rev-parse --abbrev-ref HEAD', root);
}

function dirty(root) {
  return command('expr $(git status --porcelain 2>/dev/null| egrep "^(M| M)" | wc -l)', root);
}

function command(cmd, root) {
  return new Promise(function(resolve, reject){
    exec(cmd, {cwd:root}, function(err, stdout, stderr){
      var error = stderr.trim();
      if (error){
	reject(new Error(`${error} / ${cmd}`));
      } else {
	resolve(stdout.split('\n').join(''));
      }
    });
  });
}

module.exports = function(root){
  if (typeof(root) !== 'string'){
    root = __dirname;
  }
  return new Promise(function(resolve, reject){
    var filename = path.resolve(root, "package.json");
    var pversion = require(filename).version;

    if (!pversion){
      pversion = "0.0.0";
    }
    pversion = pversion.split('.');
    pversion.forEach(function(v, i, a){
      v = parseInt(v);
      a[i] = (v !== Number.NaN) ? v : 0;
    });

    var promise = [
      commit(root),
      branch(root),
      dirty(root)
    ];

    promise = Promise.all(promise).then(function(results){
      if (results[2] > 0){
	pversion[2] += 1;
	resolve(pversion.join('.') + " - " + results[1] + ":" + results[0]);
      } else {
	resolve(pversion.join('.'));
      }
    });
  });
};
