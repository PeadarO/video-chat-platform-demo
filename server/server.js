var expressApp = require('express')(),
  server = require('http').Server(expressApp),
  socketio = require('socket.io')(server),
  http = require('http'),
  rooms = {},
  userIds = {};

server.listen(4201);

expressApp.get('/', function(req, res) {
  res.send('Server listening on port 4201');
});

socketio.on('connection', function(socket) {

  var currentRoom, id;

  socket.on('room/get', function() {
    return rooms;
  });

  socket.on('room/enter', function(data, fn) {
    currentRoom = (data || {}).room;
    var room = rooms[currentRoom];
    if (!room) {
      rooms[currentRoom] = [socket];
      id = userIds[currentRoom] = 0;
      console.log('Room created, with #', currentRoom);
    } else {
      userIds[currentRoom] += 1;
      id = userIds[currentRoom];
      rooms[currentRoom][id] = socket;
    };
    socket.emit('selfid',id);
    socket.broadcast.emit('peer/connected', {
      roomid: currentRoom,
      id: id
    });
    console.log('Peer connected to room', currentRoom, 'with #', id);
  });

  socket.on('msg', function(data) {
    var to = parseInt(data.to, 10);
    if (rooms[currentRoom] && rooms[currentRoom][to]) {
      console.log('Redirecting message to', to, 'by', data.by);
      rooms[currentRoom][to].emit('msg', data);
    } else {
      console.warn('Invalid user');
    }
  });

  socket.on('room/leave', function() {
    console.log('disconnected');
    if (!currentRoom || !rooms[currentRoom]) {
      return;
    }
    delete rooms[currentRoom][rooms[currentRoom].indexOf(socket)];
    rooms[currentRoom].forEach(function(socket) {
      if (socket) {
        socket.emit('peer/disconnected', {
          id: id
        });
      }
    });
  });
});
