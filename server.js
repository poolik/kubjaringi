var WebSocketServer = require("ws").Server;
var http = require("http");
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var flash = require('connect-flash');
var multer  = require('multer');
var deferred = require('deferred');
var pg = require('pg');
var app = express();
var port = process.env.PORT || 5000;
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy, APIStrategy = require('passport-localapikey').Strategy;

var _ = require('underscore');
var fs = require('fs');
var authenticatedSocket = null;
var API_KEY = process.env.KUBJARINGI_SHARED_SECRET;

var UPLOADS = './uploads';
if (!fs.existsSync(UPLOADS)) {
  fs.mkdirSync('./uploads');
}
var USER = {name: "külaelanik"};

passport.use(new LocalStrategy(
    function(username, password, done) {
      process.nextTick(function () {
        if (process.env.PASSWORD !== password) return done(null, false, { message: 'Incorrect password.' });
        return done(null, USER);
      });
    }
));

passport.use(new APIStrategy(
    function(apikey, done) {
      if (apikey !== API_KEY) return done(null, false);
      return done(null, USER);
    }
));

passport.serializeUser(function(user, done) {
  done(null, user.name);
});

passport.deserializeUser(function(id, done) {
  done(null, {name:"külaelanik"});
});

// Define static HTML files
app.use(express.static(__dirname + '/static'));
app.use("/data", express.static(__dirname + '/uploads'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({secret: '35gas()"Fe'}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
    function(req, res) {
      res.redirect('/');
    });

app.post('/file-upload', multer({ dest: './uploads/', putSingleFilesInArray: true, limits: {fileSize:5000000}}),
    function(req, res, next) {
      passport.authenticate('localapikey', function(err, user, info) {
        if (err) { return next(err); }
        if (!user) {
          _.each(req.files, function(file) {
            _.each(file, function(f) {fs.unlink(f.path);});
          });
          res.status(401).end();
        } else {
          _.each(req.files, function(file) {
            var metadata = file[0];
            fs.rename(metadata.path, UPLOADS + "/" + metadata.originalname);
          });
          res.status(200).end();
        }
      })(req, res, next);
});

app.get('/login',function(req, res){
  res.sendFile(__dirname + '/html/login.html');
});

app.get('/status',function(req, res){
  if (authenticatedSocket === null) res.status(503).end();
  else res.status(200).end();
});

app.get('/', ensureAuthenticated, function(req, res){
  res.sendFile(__dirname + '/html/index.html');
});

function wasIsaveActive(client) {
  var d = deferred();
  client.query("SELECT active FROM remote where isave = true AND active = true").on('end', function(result) {
    d.resolve(result.rowCount !== 0);
  });
  return d.promise;
}

function updateActiveMode(client, wasActive, req) {
  var d = deferred();
  var setActiveQuery = 'UPDATE remote SET active = CASE '+
      '  WHEN isave = ' + req.body.isave + ' THEN true ' +
      '  WHEN isave = ' + !req.body.isave + ' THEN false ' +
      'END';
  var query = client.query(setActiveQuery);
  query.on('error', function (error) { d.reject(error); });
  query.on('end', function () { d.resolve(wasActive); });
  return d.promise;
}

function updateRemoteState(client, req) {
  var d = deferred();
  var query = client.query('UPDATE remote SET temperature = $1, mode = $2 WHERE isave = false', [req.body.temperature, req.body.mode]);
  query.on('error', function (error) { d.reject(error); });
  query.on('end', function () { d.resolve(); });
  return d.promise;
}

function sendRemoteState(state) {
  var d = deferred();
  authenticatedSocket.once('message', function(msg) {
    var msgObj = JSON.parse(msg);
    console.log("RECEIVED", msgObj);
    clearTimeout(timeoutId);
    if (_.has(msgObj, "error")) d.reject(msgObj.error);
    else d.resolve(state);
  });
  var timeoutId = setTimeout(function () {
    d.reject("Remote is not answering!");
  }, 10000);
  console.log("SENDING:", state);
  authenticatedSocket.send(JSON.stringify(state));
  return d.promise;
}

function getInitialState(client) {
  var d = deferred();
  var query = client.query('SELECT * FROM remote');
  query.on('row', function (row, result) { result.addRow(row); });
  query.on('error', function (error) { d.reject(error); });
  query.on('end', function (result) { d.resolve(result.rows); });
  return d.promise;
}

function restoreRow(client, row) {
  var d = deferred();
  var query = client.query('UPDATE remote SET temperature = $1, mode = $2, active = $3 where isave = $4', [row.temperature, row.mode, row.active, row.isave]);
  query.on('error', function (error) {
    console.log("Failed to rollback row: " + row + " because of: " + error);
    d.reject("Failed to rollback row: " + row + " because of: " + error)
  });
  query.on('end', function () { console.log("successfully rolled back: ", row); d.resolve(); });
  return d.promise;
}

function restoreInitialState(client, initialState, originalError) {
  var d = deferred();
  restoreRow(client, initialState[0])
      .then(function() {
          return restoreRow(client, initialState[1]);
      })
      .done(
        function () { d.reject(originalError + " Successfully rolled back!") },
        function (error) { d.reject(originalError + " Failed to roll back: " + error) });
  return d.promise;
}

app.post('/remote', ensureAuthenticated, function(req, res) {
  if (authenticatedSocket !== null) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      getInitialState(client).then(function (initialState) {
        return wasIsaveActive(client)
            .then(function (wasActive) {
              return updateActiveMode(client, wasActive, req);
            })
            .then (function (wasActive) {
              if (!wasActive) return updateRemoteState(client, req);
              else return deferred(1);
            })
            .then (function () {
              return queryRemoteState(client);
            })
            .then (function (state) {
              return sendRemoteState(state);
            })
            .catch(function (error) {
              return restoreInitialState(client, initialState, error);
            })
      })
      .done(function (state) {
        res.status(200).send(state);
        done();
      }, function (error) {
        done();
        console.error(error);
        res.status(500).send("ERROR: " + error);
      });
    });
  } else {
    res.status(503).send("ERROR: remote is offline!");
  }
});

app.get('/remote', ensureAuthenticated, function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    queryRemoteState(client).done(function (state) {
        done();
        res.status(200).send(state);
      }, function (error) {
        done();
        console.error(error);
        res.status(500).send("ERROR: " + error);
    });
  });
});

function queryRemoteState(client) {
  var d = deferred();
  client.query('SELECT * FROM remote WHERE active = true', function (err, result) {
    if (err) d.reject(err);
    else d.resolve(result.rows[0]);
  });
  return d.promise;
}

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
          try {
            authenticatedSocket.ping();
            authenticatedSocket.pingssent++;
          } catch (e) {
            console.error(e);
            authenticatedSocket.close();
          }
        }
      }, 30 * 1000);  //  30 seconds between pings
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

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}