var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var WebSocket = require('ws');
var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

var server = app.listen(3000);
var wss = new WebSocket.Server({ port: 4000 });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

var statServers = [];
var streamServers = [];
var serverWeight = [];
var cpu = [];
var openfd = [];
var w1 = 0.5;
var w2 = 0.5;
var x, i;
var preferredServer = 0;
var excludedServer = 8000;
var data;
var dMessageEvent = true;//false indicates if dMessageEvent originated from messageEvent
//Declare a global variable, to continue with old config.json values or not
var isArrayEqual = true;
var isEqualFalse = 0;
var currentArray;
var wsc = [];
var contents = fs.readFileSync('config.json');
var config = JSON.parse(contents);
var scannedArray = scanConfigFile(config);
statServers = scannedArray[0];
streamServers = scannedArray[1];
app.set('streamServers', streamServers);

setInterval (function() {
    //if (isArrayEqual === true) {
      contents = {};
      config = {};
      currentArray = [];
      contents = fs.readFileSync('config.json');//returns buffer
      config = JSON.parse(contents);
      console.log('Scanning config file for changes.....');
      //Contains the updated file information
      currentArray = scanConfigFile(config);
      console.log('currentArray[statServers]', currentArray[0][0]);
      //make decision whether file has changed by looking at differences in arrays
      isArrayEqual = setIsArrayEqual (statServers, currentArray[0]);

      if (isArrayEqual === false){
          console.log('Config file changed: ', isArrayEqual);
          console.log('File content: ', config)
      }
      else {
          console.log('Config file changed: ', isArrayEqual);
          console.log('File content: ', config)
      }

}, 36000);


/* Top Level function */

runProgram();

function runProgram(){
    if (isArrayEqual === true) {
      console.log('if.....runprogram() ', isArrayEqual);
      console.log('statServers..........', statServers);
      console.log('statServers.length-1........', statServers.length-1);
      for (x = 0; x <= statServers.length -1; x++) {
        scanServers(statServers[x], x)
      }
    }
    else{
      statServers = [];
      statServers = replaceArray(statServers, currentArray[0]);
      for (x in statServers){
        console.log('updated statServers: ', statServers[x])
      }
      //streamServers.slice(0, streamServers.length-1);
      streamServers = [];
      streamServers = replaceArray(streamServers, currentArray[1]);
      for (x in streamServers){
        console.log('updated streamServers: ', streamServers[x])
      }
      app.set('streamServers', streamServers);
      console.log('else.....runprogram() ', isArrayEqual);
      isArrayEqual = true;
      //scanServers(statServers[x], x);
      setTimeout(function(){runProgram()},10000);
    }
}

function scanServers(statServer, i){
     console.log('serverIP: ', statServer);

     wsc[i] = new WebSocket(statServer);

     wsc[i].on('open', openEvent);
     function openEvent () {
     //wsc.on('open', function(event) {
     console.log('Connection opened for ', wsc[i].url);
     }
     wsc[i].on('close', closeEvent);
     function closeEvent(){
     //wsc.on('close', function(event){
     console.log('Server connection closed for ', statServer);
     console.log('ws.on(close) Excluded server set.');
     serverWeight.splice(i, 1, excludedServer);//insert the dummy weight for the server that is down
     //check if al servers are up
     d = serverStatus(serverWeight);
     console.log('var d:', d);
     /* Reconnect upon socket close and dynamically update and connect to nodes without a server restart */
     //1)
     if (d === false && isArrayEqual === false){
       //if (i===serverWeight.length-1 && serverWeight[serverWeight.length-1] === excludedServer){
        console.log('Destroying old connections at closeEvent.........');
        console.log('serverWeight.length ', serverWeight.length);
        //a)
        //if (serverWeight.length > 1 && i === serverWeight.length-1){
        if (i === statServers.length-1){
           console.log(wsc[i].url);//closes all connections
           wsc[i].close();
           wsc[i].removeListener('close', closeEvent);
           console.log('Triggering isArrayEqual false on *closeEvent* -> All But last server down..........');
           setTimeout(function(){ runProgram()}, 15000);
           return;//stops the function here
       }
       //b)
       /*else if (statServers.length === 1){
          console.log(wsc[i].url);//closes all connections
          wsc[i].close();
          wsc[i].removeListener('close', closeEvent);
          console.log('Triggering isArrayEqual false on *closeEvent* -> All But last server down..........');
          setTimeout(function(){ runProgram()}, 15000);
          return;//stops the function here
       }*/
       //a-sub)
       else {
         console.log('DEBUG: Investigate.....');
         console.log(wsc[i].url);
         wsc[i].close();//close individual connections *** Needs to be tested
         wsc[i].removeListener('close', closeEvent);
       }
     }
     //2)
     else if(d === false && isArrayEqual === true){
       //a)
       //if (statServers.length > 1 && i === serverWeight.length-1){
       if (i === statServers.length-1){
           x = findOptimalServer(serverWeight, excludedServer);
           app.set('x', x);
           app.set('serverWeight', serverWeight);
           broadcastIP(streamServers[x]);
           console.log('One or more servers down. Restarting the connection after last server is scanned....');
           wsc[i].close();
           wsc[i].removeListener('close', closeEvent);
           setTimeout(function(){scanServers(statServer, i)}, 5000);
       }
/*not required as one server will be either up or down which will be taken care by wsc.onmessage and #3) respectively
       else if (serverWeight.length === 1){
         x = findOptimalServer(serverWeight, excludedServer);
         app.set('x', x);
         app.set('serverWeight', serverWeight);
         broadcastIP(streamServers[x]);
         wsc[i].close();
         wsc[i].removeListener('close', closeEvent);
         setTimeout(function(){scanServers(statServers, i)}, 5000);
       }*/
       //a-sub)
       else {
           console.log('One or more servers down. Restarting the connection to all but last server....');
           wsc[i].close();
           wsc[i].removeListener('close', closeEvent);
           setTimeout(function(){scanServers(statServer, i)}, 5000);
       }
     }
     //3)
     else if(d === true && isArrayEqual === false){
       //if (i === serverWeight.length-1 && serverWeight[serverWeight.length-1] === excludedServer){
         console.log('Destroying old connections at closeEvent.........');
         console.log('Current index is ', i);
         //if (serverWeight.length > 1 && i === serverWeight.length-1){//restarts connection with new config if there are more than one server in the config
         if (i === statServers.length-1){
             console.log(wsc[i].url);
             wsc[i].close();
             wsc[i].removeListener('close', closeEvent);
             console.log('Triggering isArrayEqual false on *closeEvent* -> All servers down..........');
             //if connection is already closed by messageEvent
             setTimeout(function(){runProgram()}, 15000);
             return;
         }
         /*else if (statServers.length === 1){//restarts connection with new config if there is only one server in the config
             console.log(wsc[i].url);
             wsc[i].close();
             wsc[i].removeListener('close', closeEvent);
             console.log('Triggering isArrayEqual false on *closeEvent* -> All servers down..........');
             setTimeout(function(){runProgram()}, 15000);
             return;
       }*/
       else {//closes all but last server connection
           console.log(wsc[i].url);
           wsc[i].close();
           wsc[i].removeListener('close', closeEvent);
       }
     }
     //4)
     else if(d === true && isArrayEqual === true) {//need to check why is it setting and broadcasting
       //if (i === serverWeight.length-1 && serverWeight[serverWeight.length-1] === excludedServer){
       //if (serverWeight.length > 1 && i === serverWeight.length-1){//restarts connection to last server
       if (i === statServers.length-1 && dMessageEvent === true){
           app.set('d', d);
           console.log('All servers down. Restarting the connection after last server is scanned....')
           wsc[i].close();//close individual connections *** Needs to be tested
           wsc[i].removeListener('close', closeEvent);
           setTimeout(function(){scanServers(statServer, i)}, 5000);
           return;
       }
       /*else if (statServers.length === 1){//restarts connection to first server
         //app.set('d', d);
         console.log('All servers(more than one) down. Restarting the connection after one server is scanned....')
         wsc[i].close();//close individual connections *** Needs to be tested
         wsc[i].removeListener('close', closeEvent);
         setTimeout(function(){scanServers(statServer, i)}, 5000);
       }*/
       else{////restarts connection to all but last server
         console.log('All servers (one) down. Restarting the connection after last but all servers scanned....')
         wsc[i].close();//close individual connections *** Needs to be tested
         wsc[i].removeListener('close', closeEvent);
         setTimeout(function(){scanServers(statServer, i)}, 5000);
         return;
       }
     }
     //Final else
     console.log('Most conditions are tested and *** Add *** more conditions if found after testing.........')
     }

     wsc[i].on('error', errorEvent);
     function errorEvent(){
     //wsc.on('error', function(error) {
     console.log('An error occurred for ', statServer);
     }

     wsc[i].on('message', messageEvent);
     function messageEvent(data){
        //wsc.on('message', function (data){
        //Parse the incoming JSON object and extract relevant pivots
        console.log('cpu'+i+': '+ parseInt(JSON.parse(data).cpu));
        console.log('openfd'+i+': '+ parseInt(JSON.parse(data).openfd));
        cpu[i]= parseInt(JSON.parse(data).cpu);
        openfd[i] = parseInt(JSON.parse(data).openfd);

        serverWeight[i] = cpu[i] * w1 + openfd[i] * w2;
        console.log('serverWeight['+i+']'+ serverWeight[i]);
        d = serverStatus(serverWeight);
        //find a trigger point like when to calculate index
        /* If none of the server weight is equal to exclude server i.e. 8000, get the minimum weight */
        if (isArrayEqual === false){
            console.log('Destroying old connections at messageEvent............');
            if (i === statServers.length -1){//if last server weight NOT equal to excludedServer and it is the last server
                                                                                                      //=> if last server isnt down and reached last server weight calculation, determine optimal server
                                                                                                      //executed when last server is not dummy server
                console.log(wsc[i].url);
                wsc[i].close();
                wsc[i].removeEventListener('message', messageEvent);
                dMessageEvent = false;//false indicates intermediate status, that system config is being renewed on par with config.json changes
                console.log('Triggering isArrayEqual false on *messageEvent* -> All servers(more than one) up..........');
                //closeEvent();
                //setTimeout(function(){runProgram()}, 15000);
                return;
            }
            /*else if (statServers.length === 1){g
                console.log(wsc[i].url);
                wsc[i].close();
                wsc[i].removeEventListener('message', messageEvent);
                console.log('Triggering isArrayEqual false on *messageEvent* -> All servers(only one) up..........');
                //setTimeout(function(){runProgram()}, 15000);
                return;
            }*/
            else{
                console.log(wsc[i].url);
                wsc[i].close();
                wsc[i].removeEventListener('message', messageEvent);
                return;
            }
        }
        else{
           x = findOptimalServer(serverWeight, excludedServer);
           app.set('x', x);
           app.set('serverWeight', serverWeight);
           app.set('d', d);
            //data = streamServers[x];
           broadcastIP(streamServers[x]);
           dMessageEvent = true;//indicates intermediate status that system config are not changed currently
        }
      }
}//scanServers() ends here

function setIsArrayEqual (oldArray, newArray){
    //isEqualFalse = 0;
    console.log('old array...');
    for (i in oldArray) console.log(oldArray[i]);

    console.log('new array...');
    for (i in newArray) console.log(newArray[i]);

    if(newArray.length !== oldArray.length){
        //isEqualFalse++;
        return false;
    }
    for(var i = oldArray.length; i--;) {
        if(oldArray[i] !== newArray[i]){
          //isEqualFalse++;
          return false;
        }
    }
    return true;
}

function scanConfigFile(tempConfig) {
   var scanIP = [],
       streamIP = [];
       i = 0;
   console.log('temporary config file contains following scanIP and streamIP:')
   for (x in tempConfig){
      console.log(tempConfig[x].scanIP);
      scanIP[i] = JSON.stringify(tempConfig[x].scanIP);
      console.log(tempConfig[x].streamIP);
      streamIP[i] = JSON.stringify(tempConfig[x].streamIP);
      scanIP[i] = scanIP[i].replace(/"/g, '');
      streamIP[i] = streamIP[i].replace(/"/g, '');
      i++;
   }
   return [scanIP, streamIP];
}

function replaceArray(statServers, newArray) {
    console.log('Before : statServers[0]'+ statServers[0] + ' newArray:'+ newArray);

    statServers.slice(0, statServers.length);
    for (var i = 0; i <= newArray.length - 1; i++) {
      statServers[i] = newArray[i]
    }
    console.log('New content after replacing...');
    for (x in statServers) {
      console.log(statServers[x])
    }
    return statServers;
}

//finds the minimum weight server or optimal server when servers have differential or equal weight
function findOptimalServer(serverWeight, index){
    console.log('index: ', index);
    var idu = checkUndefinedServer(serverWeight);//returns true if there is atleast one undefined else, returns false

    var idex = checkExcludedServer(serverWeight, index);//returns true if there is one excluded server
    console.log('idex val: ', idex);
    //All servers are up, this code block gets executed
    if(idu === true){//this scenario arises when server starts up
      x = preferredServer;
      console.log('Atleast one server undefined- var x:', x);
    }
    else if(idex === false){//when all servers up
      var ide = checkEqualityOfServer(serverWeight, index);
      if (ide === true){
        x = Math.floor(Math.random() * serverWeight.length);
        console.log('All servers up. Random server- var x', x);
      }
      else{
        x = serverWeight.indexOf(Math.min.apply(Math, serverWeight));
        if (x === -1){
          x = preferredServer;
          console.log('All servers up. Min weight server- var x=-1', x);
        }
        else
          console.log('All servers up. Min weight server- var x', x);
      }
    }
    //one or more server goes down, this code block gets executed
    else if(idex === true){

      ide = checkEqualityOfServer(serverWeight, index);
      if (ide === true){
        x = findRandomServer(serverWeight, index);
        console.log('one or more servers down. Random server- var x', x);
      }
      else{
        x = findMinWeightServer(serverWeight, index);
        if (x === -1){
          x = preferredServer;
          console.log('one or more servers down. Min weight server- var x=-1', x);
        }
        else{
          console.log('one or more servers down. Min weight server- var x', x);
        }
      }
    }
    else
      console.log('No Additional conditions found as of now.');

    return x;
}

//finds random server for excluded server case when other server weights are equal
function findRandomServer(serverWeight, indexServer){

  //find the random index first.lets say, x;
  x = Math.floor(Math.random() * serverWeight.length);
  //
  while (serverWeight[x] === indexServer){//index can be includeServer or excludeServer, if equals, then calculate index again else, exit.
    x = Math.floor(Math.random() * serverWeight.length);
  }
  return x;
}
//finds random server for excluded server case, when other server weights are equal
function findMinWeightServer(serverWeight, index){

  //find the first element that is not excludeserver
  function firstMin(serverWeight){
    return serverWeight !== index;
  }
  var min = serverWeight.find(firstMin);

  //find the min index that is not exclude server
  for (i = 0; i < serverWeight.length; i++){
    //setting the first element in an array
    if (serverWeight[i] !== index){
       if(serverWeight[i] < min){
         min = serverWeight[i];
       }
    }
  }
  return serverWeight.indexOf(min);
}

//checks if server weights are equal
function checkEqualityOfServer(serverWeight, index) {
  for(var i = 0; i < serverWeight.length; i++) {
    //console.log('serverWeight['+i+']'+ serverWeight[i]);
    if(serverWeight[i] !== index){//not equal excludeserver or includeServer
      if(serverWeight[i] !== serverWeight[0])
        return false;
    }
  }
  return true;
}
//check undefined
function checkUndefinedServer(serverWeight) {
  for(var i = 0; i < serverWeight.length; i++) {
    if(serverWeight[i] === 'undefined')
     return true;
  }
  return false;
}
//check one or more server excluded or all servers included
function checkExcludedServer(serverWeight, index){
  for(var i = 0; i < serverWeight.length; i++) {
    if(serverWeight[i] === index)
     return true;
  }
  return false;
}

//check if all servers are down
function serverStatus(serverWeight){
  for (var i = 0; i < serverWeight.length; i++){
    if (serverWeight[i] !== excludedServer)
      return false;
  }
  return true;
}

//check for NaN
function checkNaN(serverWeight) {
  for(var i = 0; i < serverWeight.length; i++) {
    isNaN(!serverWeight[i])
     return false;
  }
  return true;
}

//broadcast available IP's
function broadcastIP(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      //if (data.cpu !== null && data.openfd !== null)
      client.send(data);
      //console.log(data);
      console.log('socket IP sent', data);
      client.terminate();
    }
  });
}

module.exports = app;
