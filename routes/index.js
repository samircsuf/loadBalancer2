var express = require('express');
var router = express.Router();
//var session = require('express-session');
//var MongoDBStore = require('connect-mongodb-session')(session);
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

//var streamServers = ['ws://192.168.1.101:8082', 'ws://192.168.1.102:8082','ws://192.168.0.241:8082'];
var streamServers = ['ws://192.168.0.101:8082', 'ws://192.168.0.201:8082','ws://192.168.0.241:8082'];

var nonElement = 8000;
var serverWeight = [];
var finalIndex;
var d = 0;
var x;

/* Create Session and direct to suitable ws server. */
router.get('/', function(req, res, next) {
  //TO TEST
  //Additional check incase server goes down between the time server was selected and response was sent.
  //get the index and serverweight array
  console.log('req.route: ', req.route);
  d = req.app.get('d');
  console.log('d value: ', d);
  if (d === true) {
     res.render('index', { title: 'JSMpeg Stream Servers are down.', errorMsg: 'All Servers are currently down. Please retry after sometime.'});
  }
  else {
       x = req.app.get('x');//Gets variable x from app.js
       serverWeight = req.app.get('serverWeight');

       //Compare this index X with serverWeight index. If matches, chose alternate server whose serverWeight !== nonElement
       if (serverWeight[x] === nonElement){
          finalIndex = serverWeight.findIndex(nonMatchingIndex);//finds the server which is up
          console.log('finalIndex if server went down: ', finalIndex);
       }
       else {
            finalIndex = x;
            console.log('finalIndex if server is up: ', finalIndex);
       }

       //console.log('secondaryIndex', secondaryIndex);
       serverWeight.forEach(function(element){
       console.log('element', element);
       });
       res.render('index', { title: 'JSMpeg Stream Client', url: streamServers[finalIndex]});
  }
});

//finds an element that is not matching a server that is down
function nonMatchingIndex(element){
  return element !== nonElement;
}

module.exports = router;
