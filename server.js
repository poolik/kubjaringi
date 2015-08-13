var WebSocketServer = require("ws").Server;
var http = require("http");
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var flash = require('connect-flash');
var multer  = require('multer');
var pg = require('pg');
var app = express();
var port = process.env.PORT || 5000;
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy, APIStrategy = require('passport-localapikey').Strategy;

var _ = require('underscore');
var fs = require('fs');
var authenticatedSocket = null;
var API_KEY = process.env.INGLISTE_SHARED_SECRET;

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

app.post('/remote', ensureAuthenticated, function(req, res) {
  if (authenticatedSocket !== null) {
    authenticatedSocket.once('message', function(msg) {
      var msgObj = JSON.parse(msg);
      console.log("RECEIVED", msgObj);
      if (_.has(msgObj, "error")) res.status(500).send("ERROR: " + msgObj.error);
      else {
        pg.connect(process.env.DATABASE_URL, function(err, client, done) {
          client.query('UPDATE remote SET temperature = $1, mode = $2, isave = $3', [req.body.temperature, req.body.mode, req.body.isave], function(err, result) {
            done();
            if (err) {
              console.error(err);
              response.status(500).send("ERROR: " + err);
            } else {
              res.status(200).send("SUCCESS: " + msgObj.success);
            }
          });
        });
      }
    });
    console.log("SENDING:", req.body);
    authenticatedSocket.send(JSON.stringify(req.body));
  } else {
    res.status(503).send("ERROR: remote is offline!");
  }
});

app.get('/remote', ensureAuthenticated, function(req, res) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('SELECT * FROM remote', function(err, result) {
      done();
      if (err) {
        console.error(err);
        response.status(500).send("Error " + err);
      } else {
        console.log(result.rows);
        res.status(200).send(result.rows[0]);
      }
    });
  });
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