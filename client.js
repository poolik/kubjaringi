var exec = require('child_process').exec;
var WebSocket = require('ws');
var fs = require('fs');
var winston = require('winston');

if (!fs.existsSync(__dirname + '/log')){
  fs.mkdirSync(__dirname + '/log');
}
winston.add(winston.transports.File, {filename: __dirname + '/log/client.log', maxsize:10000000, maxFiles: 10});

var devices = {};

var getCommandsForDevice = function(deviceName) {
  return function(error, stdout, stderr) {
    var lines = stderr.split("\n");
    for(var lineIndex in lines) {
      var line = lines[lineIndex];
      var parts = line.split(" ");
      if(parts.length>2) {
        var keyName = parts[2];
        devices[deviceName].push(keyName);
        winston.info(deviceName + " found key: "+keyName);
      }
    }
  }
};

var getDevice = function (error, stdout, stderr) {
  if(error) {
    winston.info("irsend not available.");
    return;
  }
  var lines = stderr.split("\n");
  for(var lineIndex in lines) {
    var line = lines[lineIndex];
    var parts = line.split(" ");
    if(parts.length>1) {
      var deviceName = parts[1];
      winston.info("device found: "+deviceName.trim());
      devices[deviceName] = [];
      exec("irsend list \""+deviceName+"\" \"\"", getCommandsForDevice(deviceName));
    }
  }
};

exec("irsend list \"\" \"\"", getDevice); // Get all device information

host = "localhost:5000";
new ReconnectSocket(host).connect();

function ReconnectSocket(url) {
  this.url = url;
  this.ws = undefined;
  var reconnectDecay = 1.5;
  var reconnectAttempts = 0;
  var reconnectInterval = 1000; // 1 sec
  var maxReconnectInterval = 300000; // 5 min
  var that = this;

  this.connect = function() {
    try {
      that.ws = createSocket();
    } catch (e) {
      winston.error(e);
    }
    registerHandlers();
  };

  function registerHandlers() {
    that.ws.once('open', open);
    that.ws.on('message', message);
    that.ws.once('close', reconnect);
    that.ws.once('error', reconnect);
  }

  function createSocket() {
    return new WebSocket('ws://' + that.url);
  }

  function reconnect() {
    var timeout = reconnectInterval * Math.pow(reconnectDecay, reconnectAttempts);
    setTimeout(function () {
      winston.info("Reconnecting!");
      reconnectAttempts++;
      that.connect();
    }, timeout > maxReconnectInterval ? maxReconnectInterval : timeout);
  }

  function open() {
    winston.info("Connected!");
    reconnectAttempts = 0;
    that.ws.send(JSON.stringify({apikey:fs.readFileSync(__dirname+"/apikey.txt", "UTF-8")}));
  }

  function message(data, flags) {
    var messageObj = JSON.parse(data);
    winston.info("RECEIVED: ", messageObj);

    var deviceName = messageObj.device;
    var key = messageObj.key.toUpperCase();

    if (!devices.hasOwnProperty(deviceName)) { // Make sure that the user has requested a valid device
      sendError("invalid device " + deviceName);
      return;
    }

    var device = devices[deviceName]; // Make sure that the user has requested a valid key/button
    var deviceKeyFound = false;
    for (var i = 0; i < device.length; i++) {
      if (device[i] === key) {
        deviceKeyFound = true;
        break;
      }
    }
    if (!deviceKeyFound) {
      sendError("invalid key number: " + key);
      return;
    }

    // send command to irsend
    var command = "irsend SEND_ONCE " + deviceName + " " + key;
    exec(command, function (error, stdout, stderr) {
      if (error)
        sendError("Error sending command");
      else
        sendSuccess("Successfully sent command");
    });
  }

  function sendError(message) {
    winston.error(message);
    that.ws.send(JSON.stringify({error: message}));
  }

  function sendSuccess(message) {
    winston.info(message);
    that.ws.send(JSON.stringify({success: message}));
  }
}