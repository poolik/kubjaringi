var WebSocketServer = require("ws").Server;
var http = require("http");
var express = require('express');
var app = express();
var port = process.env.PORT || 5000;
//var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;

var _ = require('underscore');
var fs = require('fs');
var authenticatedSocket = null;

// Define static HTML files
app.use(express.static(__dirname + '/html'));
app.use("/data", express.static(__dirname + '/temp'));

var API_KEY = process.env.INGLISTE_SHARED_SECRET;

// define GET request for /send/deviceName/buttonName
app.get('/send/:device/:key', function(req, res) {
  var deviceName = req.param("device");
  var key = req.param("key").toUpperCase();

  if (authenticatedSocket !== null) {
    authenticatedSocket.once('message', function(msg) {
      var msgObj = JSON.parse(msg);
      console.log("RECEIVED", msgObj);
      if (_.has(msgObj, "error")) res.send("ERROR: " + msgObj.error);
      else res.send("SUCCESS: " + msgObj.success);
    });
    var data = JSON.stringify({device: deviceName, key: key});
    console.log("SENDING:", data);
    authenticatedSocket.send(data);
  }
});

var server = http.createServer(app);
server.listen(port);
var wss = new WebSocketServer({server: server});

wss.on("connection", function(ws) {
  ws.once('message', function(msg){
    var msgObj = JSON.parse(msg);
    if (_.has(msgObj, "apikey") && msgObj.apikey === API_KEY) {
      console.log("websocket connection open");
      authenticatedSocket = ws;
      var id = setInterval(function() {
        if (authenticatedSocket.pingssent >= 2) authenticatedSocket.close();
        else {
          authenticatedSocket.ping();
          authenticatedSocket.pingssent++;
        }
      }, 75 * 1000);  //  75 seconds between pings
      authenticatedSocket.on("close", function() {
        console.log("websocket connection close");
        clearInterval(id);
        authenticatedSocket = null;
      });
      authenticatedSocket.on("pong", function() {
        authenticatedSocket.pingssent = 0;
      });
    } else {
      ws.close();
    }
  });
});