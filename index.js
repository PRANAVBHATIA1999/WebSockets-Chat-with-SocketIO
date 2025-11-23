const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

// socket.id -> nickname
const users = new Map();

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  // Set nickname for this socket
  socket.on('set nickname', (nickname) => {
    users.set(socket.id, nickname);
    console.log(`nickname set: ${socket.id} => ${nickname}`);

    io.emit('system message', `${nickname} joined the chat`);
    io.emit('user list', Array.from(users.values()));
  });

  // Normal chat message: broadcast to everyone else
  socket.on('chat message', (msg) => {
    const nickname = users.get(socket.id) || 'Anonymous';
    console.log(`message from ${nickname}: ${msg}`);

    // send to everyone EXCEPT the sender
    socket.broadcast.emit('chat message', { nickname, msg });
  });

  // "user is typing"
  socket.on('typing', () => {
    const nickname = users.get(socket.id) || 'Someone';
    socket.broadcast.emit('typing', nickname);
  });

  // Private message: /w user message
  socket.on('private message', ({ to, msg }) => {
    const from = users.get(socket.id) || 'Anonymous';
    const targetEntry = [...users.entries()].find(
      ([_, name]) => name === to
    );

    if (targetEntry) {
      const [targetId] = targetEntry;
      io.to(targetId).emit('private message', { from, msg });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const nickname = users.get(socket.id);
    if (nickname) {
      users.delete(socket.id);
      io.emit('system message', `${nickname} left the chat`);
      io.emit('user list', Array.from(users.values()));
    }
    console.log('user disconnected', socket.id);
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
