require("aframe");
var host = window.document.location.host.replace(/:.*/, '');
var socket = new WebSocket('ws://' + host + ':3000');
socket.onopen = function (event) {
  console.log("Socket connected to server!");
  socket.send("Hello server!");
};

socket.onmessage = function(event){
  console.log("Obtained a message.");
};
