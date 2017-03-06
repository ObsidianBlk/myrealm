var path = require('path');
var express = require("express");
var app = express();

/* serves main page */
app.get("/", function(req, res) {
  res.sendfile(path.resolve('client/index.html'));
});

/* serves all the static files */
app.get(/^(.+)$/, function(req, res){ 
  console.log('static file request : ' + req.params);
  res.sendfile(path.resolve('client/' + req.params[0])); 
});

app.listen(3000, function () {
  console.log("Listening on port 3000!");
});
