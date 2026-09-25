const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const {
  createGame,
  joinGame,
  startGame,
  playCard,
  getPublicState
} = require('./src/game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const games = new Map();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code;

  do {
    code = Array.from(
      { length: 5 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (games.has(code));

  return code;
}

function room(code) {
  return io.to(`game:${code}`);
}

function broadcast(code) {
  const game = games.get(code);

  if (game) {
    room(code).emit('state', getPublicState(game));
  }
}

io.on('connection', (socket) => {

  // CREATE GAME
  socket.on('createGame', ({ name }, cb) => {
    const code = makeCode();

    const game = createGame(code);

    const player = joinGame(
      game,
      socket.id,
      name
    );

    socket.data.gameCode = code;

    games.set(code, game);

    socket.join(`game:${code}`);

    cb({
      ok: true,
      code,
      playerId: player.id
    });

    broadcast(code);
  });


  // JOIN GAME
  socket.on('joinGame', ({ code, name }, cb) => {
    code = String(code || '')
      .trim()
      .toUpperCase();

    const game = games.get(code);

    if (!game) {
      return cb({
        ok: false,
        error: 'Game not found.'
      });
    }

    if (game.started) {
      return cb({
        ok: false,
        error: 'Game has already started.'
      });
    }

    if (game.players.length >= 8) {
      return cb({
        ok: false,
        error: 'This game is full (maximum 8 players).'
      });
    }

    try {
      const player = joinGame(
        game,
        socket.id,
        name
      );

      socket.join(`game:${code}`);

      socket.data.gameCode = code;

      cb({
        ok: true,
        code,
        playerId: player.id
      });

      broadcast(code);

    } catch (e) {
      cb({
        ok: false,
        error: e.message
      });
    }
  });


  // START GAME
  socket.on('startGame', ({ code }, cb) => {
    const game = games.get(
      String(code).toUpperCase()
    );

    if (!game) {
      return cb?.({
        ok: false,
        error: 'Game not found.'
      });
    }

    try {
      startGame(
        game,
        socket.id
      );

      broadcast(game.code);

      cb?.({
        ok: true
      });

    } catch (e) {
      cb?.({
        ok: false,
        error: e.message
      });
    }
  });


  // PLAY CARD
  socket.on('playCard', ({ code, cardId }, cb) => {
    const game = games.get(
      String(code).toUpperCase()
    );

    if (!game) {
      return cb?.({
        ok: false,
        error: 'Game not found.'
      });
    }

    try {
      playCard(
        game,
        socket.id,
        cardId
      );

      broadcast(game.code);

      cb?.({
        ok: true
      });

    } catch (e) {
      cb?.({
        ok: false,
        error: e.message
      });
    }
  });


  // LEAVE GAME
  socket.on('leaveGame', ({ code }, cb) => {
    const roomCode = String(code || '')
      .toUpperCase();

    const game = games.get(roomCode);

    if (game) {

      game.players = game.players.filter(
        p => p.id !== socket.id
      );

      socket.leave(`game:${roomCode}`);

      if (!game.players.length) {
        games.delete(roomCode);
      } else {
        broadcast(roomCode);
      }
    }

    socket.data.gameCode = null;

    cb?.({
      ok: true
    });
  });


  // DISCONNECT
  socket.on('disconnect', () => {

    for (const [code, game] of games) {

      const player = game.players.find(
        p => p.id === socket.id
      );

      if (player && !game.started) {

        game.players = game.players.filter(
          p => p.id !== socket.id
        );

        broadcast(code);

        if (!game.players.length) {
          games.delete(code);
        }
      }
    }
  });

});


const PORT = process.env.PORT || 3000;

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `ACE SPADE running at http://localhost:${PORT}`
    );
  }
);