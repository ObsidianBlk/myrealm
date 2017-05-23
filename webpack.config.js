var server_conf = require('./server.config.json');
var webpack = require('webpack');
var path = require('path');

var www = (function(){
  if (server_conf.http){
    if (server_conf.http.path){
      return server_conf.http.path;
    }
  }
  return "www";
})();

module.exports = {
  entry: {
    myrealm: './client/main.js'
  },
  output: {
    filename: '[name]-bundle.js',
    path: path.resolve(__dirname, www)
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      minChunks: function (module) {
        // this assumes your vendor imports exist in the node_modules directory
        return module.context && module.context.indexOf('node_modules') !== -1;
      }
    })
  ]
};
