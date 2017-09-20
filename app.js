var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var WebSocket = require('ws');
//var WebSocket = require('./ext/reconnecting-websocket.min');

//var session = require('express-session');
//var MongoStore = require('connect-mongo')(session);

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

var statServers = ['ws://192.168.0.101:8083', 'ws://192.168.0.201:8083', 'ws://192.168.0.301:8083'];
//var streamServers = ['ws://127.0.0.1:8082', 'ws://127.0.0.1:8084','ws://127.0.0.1:8086'];
var serverWeight = [];
var cpu = [];
var openfd = [];
var w1 = 0.5;
var w2 = 0.5;
var x = 0;//by default redirects to 1st leg for the first time
var preferredServer = 0;
var excludedServer = 8000;
//var includeServer = 9000;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
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

//server statistics monitoring and determining index of optimal destination IP
for (var i = 0; i <= statServers.length -1; i++) scanServers(statServers[i], i);

//listens server stats and determines the optimal server
function scanServers(statServer, i){
  console.log('serverIP: ', statServer);
  var wsc = new WebSocket(statServer);

  wsc.on('open', function(event) {
    console.log('Connection opened.', statServer);
  });

  /*If any of the server is down, detect it and try to reconnect periodically and also determine optimal server based upon available servers*/
  wsc.on('close', function(event){
    console.log('Server connection closed.');
    //try to reconnect in 5 seconds
    setTimeout(function(){scanServers(statServer, i)}, 5000);//irrespective of server number, it tries to reconnect
    console.log('ws.on(close) Excluded server set.')
    serverWeight.splice(i, 1, excludedServer);//insert the dummy weight for the server that is down
    //trigger point to calculate the weight
/* If none of the server weight is equal is include server i.e. 9000, get the minimum weight. Do not need to do anything special here */
    if (i === serverWeight.length -1 && serverWeight[serverWeight.length -1] === excludedServer){//exeuted when last server is dummy server
      x = findOptimalServer(serverWeight, excludedServer);
      console.log('ws.close - var x: ', x);
      app.set('x', x);
      app.set('serverWeight', serverWeight);
    }
  });
/*
  wsc.addEventListener('error', function(e) {
          // readyState === 3 is CLOSED
      console.log('event listener object: ', e.target.readyState);
      if (e.target.readyState === 0) {
        //setTimeout(function(){scanServers(statServer, i)}, 5000);
        console.log('retrying connection for serverIP: ', statServer);
        setTimeout(function() {scanServers(statServer, i)}, 100);
      }
  }, false);
*/
  wsc.on('error', function(error) {
    console.log('An error occurred.');
    //setTimeout(function() {scanServers(statServer, i)}, 1000);
    //added from wsc.on('close')
    //setTimeout(function(){scanServers(statServer, i)}, 5000);

    //serverWeight.splice(i, 1, excludedServer);//insert the dummy weight for the server that is down
    //trigger point to calculate the weight
/* If none of the server weight is equal is include server i.e. 9000, get the minimum weight. Do not need to do anything special here */
    //if (i === serverWeight.length -1){
    //  x = findOptimalServer(serverWeight, excludedServer);
    //  console.log('ws.close - var x: ', x);
    //  app.set('x', x);
    //  app.set('serverWeight', serverWeight);
    //}
  });


  /*If all the servers are up, determine the optimal server*/
  wsc.on('message', function (data){
    //console.log('message received', data);
    //Parse the incoming JSON object and extract relevant pivots
    console.log('cpu'+i+': '+ parseInt(JSON.parse(data).cpu));
    console.log('openfd'+i+': '+ parseInt(JSON.parse(data).openfd));
    cpu[i]= parseInt(JSON.parse(data).cpu);
    openfd[i] = parseInt(JSON.parse(data).openfd);

    serverWeight[i] = cpu[i] * w1 + openfd[i] * w2;
    console.log('serverWeight['+i+']'+ serverWeight[i]);
//find a trigger point like when to calculate index
/* If none of the server weight is equal to exclude server i.e. 8000, get the minimum weight */
    if (i === serverWeight.length -1 && serverWeight[serverWeight.length -1] !== excludedServer){//if last server weight NOT equal to excludedServer and it is the last server
                                                                                                //=> if last server isnt down and reached last server weight calculation, determine optimal server
                                                                                                //executed when last server is not dummy server
      x = findOptimalServer(serverWeight, excludedServer);
      app.set('x', x);
    }
    //else if (serverWeight[i] !== excludedServer){
    //  x = findOptimalServer(serverWeight, excludedServer);
    //  app.set('x', x);
    //}
    //this block needs modification
    //else{//when last server is down, just calculates optimal server whenever any server reports a statistics+> right now every call to all other server even when all servers are up going to this block
    //  x = findOptimalServer(serverWeight, excludedServer);
    //  app.set('x', x);
      //console.log('Waiting for all server to be up.')
    //}
  });
}

//finds the minimum weight server or optimal server when servers have differential or equal weight
function findOptimalServer(serverWeight, index){
  console.log('index: ', index);
  var idu = checkUndefinedServer(serverWeight);//returns true if there is atleast one undefined else, returns false

  var idex = checkExcludedServer(serverWeight, index);//returns true if there is one excluded server

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
//check for NaN
function checkNaN(serverWeight) {
  for(var i = 0; i < serverWeight.length; i++) {
    isNaN(!serverWeight[i])
     return false;
  }
  return true;
}

//function serverArray(wssParam, index){


//Collect stats from all ws servers
//websocket message is an async request-response type, so we need to run it as soon as the server starts
//And then calculate the weight, suitable destination server address and store it in a file/object.
//When any client request comes, it reads the file/object and routes to that IP.


//mongo-connect session
/*
app.use(session({
    secret: 'password1',
    saveUninitialized: false, // don't create session until something stored
    resave: false, //don't save session if unmodified
    store: new MongoStore({
        url: 'mongodb://127.0.0.1/test',
        collection: 'sessions',
        ttl: 14 * 24 * 60 * 60, // = 14 days. Default
        touchAfter: 24 * 60 * 60 // time period in seconds for refresh sessions
    })
}));

app.use(session({
    store: new MongoStore({
      url: 'mongodb://localhost:27017/test',
      collection: 'sessions',
      ttl: 14 * 24 * 60 * 60 // = 14 days. Default
    })
}));
*/


module.exports = app;
