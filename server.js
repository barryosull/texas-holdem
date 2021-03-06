var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));

/***********************************
 * Boot routes and message handlers
 **********************************/
require('./src/http-routes')(app, io);
require('./src/socket-routes')(io);

/*******************************
 * Launch the Webserver
 *******************************/
var port = 80;
http.listen(port, () => console.log("Texas holdem server running at http://localhost:" + port));