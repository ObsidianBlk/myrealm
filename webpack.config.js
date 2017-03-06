var path = require('path');

module.exports = {
  entry: './client/src/main.js',
  output: {
    filename: 'homegrid-client.js',
    path: path.resolve(__dirname, 'client')
  }
};
