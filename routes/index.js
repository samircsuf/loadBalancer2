var express = require('express');
var router = express.Router();

var streamServers = [];
var serverWeight = [];
var nonElement = 8000;
var finalIndex;
var d = 0;
var x;

router.use(function(req, res, next) {
  streamServers = req.app.get('streamServers');
  console.log('Stream server details: ');
  for (x in streamServers)
    console.log(streamServers[x]);
  next();
});
/* Create Session and direct to suitable ws server. */
router.get('/', function(req, res, next) {
  //Additional check incase server goes down between the time server was selected and response was sent.
  //get the index and serverweight array
  d = req.app.get('d');
  console.log('d value: ', d);
  if (d === true) {
     res.render('index', { title: 'JSMpeg Stream Client.', errorMsg: 'All Servers are currently down. Please retry after sometime.'});
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
       res.render('index', { title: 'JSMpeg Stream Client.', url: streamServers[finalIndex]});
  }
});

//finds an element that is not matching a server that is down
function nonMatchingIndex(element){
  return element !== nonElement;
}

module.exports = router;
