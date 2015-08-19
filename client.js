var exec = require('child_process').exec;
var WebSocket = require('ws');
var fs = require('fs');
var winston = require('winston');

if (!fs.existsSync(__dirname + '/log')){
  fs.mkdirSync(__dirname + '/log');
}
winston.add(winston.transports.File, {filename: __dirname + '/log/client.log', maxsize:10000000, maxFiles: 10});

host = "ingliste.herokuapp.com/";
//host = "localhost:5000";
new ReconnectSocket(host).connect();

function ReconnectSocket(url) {
  this.url = url;
  this.ws = undefined;
  var intervalId = undefined;
  var reconnectDecay = 1.5;
  var reconnectAttempts = 0;
  var reconnectInterval = 1000; // 1 sec
  var maxReconnectInterval = 300000; // 5 min
  var pingsUnanswered = 0;
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
    that.ws.on('pong', function() {
      pingsUnanswered = 0;
    });
  }

  function createSocket() {
    return new WebSocket('ws://' + that.url);
  }

  function reconnect() {
    winston.info("closed!");
    clearInterval(intervalId);
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
    pingsUnanswered = 0;
    that.ws.send(JSON.stringify({apikey:fs.readFileSync(__dirname+"/apikey.txt", "UTF-8")}));
    intervalId = setInterval(function() {
      if (pingsUnanswered >= 2) that.ws.close();
      else {
        that.ws.ping();
        pingsUnanswered++;
      }
    }, 30 * 1000);  //  30 seconds between pings
  }

  function message(data) {
    var messageObj = JSON.parse(data);
    winston.info("RECEIVED: " + messageObj);
    var command = "sudo mitsu " + messageObj.temperature + " 1 " + modeToInt(messageObj.mode);
    exec(command, function (error, stdout, stderr) {
      if (error)
        sendError(stderr);
      else
        sendSuccess("Successfully sent command");
    });
  }

  function modeToInt(mode) {
    if (mode === 'HEAT') return 0;
    if (mode === 'COLD') return 1;
    if (mode === 'FAN') return 2;
    return 99;
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