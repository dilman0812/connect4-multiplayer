const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const { saveCompletedGame, getLeaderboard } = require("./db");
const { initProducer, sendEvent } = require("./kafkaProducer");
const { getBotMove } = require("./botLogic");
const {
  createEmptyBoard,
  dropDisc,
  checkWin,
  checkDraw,
} = require("./gameEngine");

// =====================
// GLOBAL STATE
// =====================
const waitingPlayers = [];
const activeGames = new Map();
const reconnectTimers = new Map(); // username -> timeout

const PORT = process.env.PORT || 8080;

// =====================
// SINGLE HTTP SERVER
// =====================
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/leaderboard" && req.method === "GET") {
    try {
      const leaderboard = await getLeaderboard();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(leaderboard));
    } catch (err) {
      res.writeHead(500);
      res.end("Error fetching leaderboard");
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

// =====================
// WEBSOCKET ATTACHED
// =====================
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("New client connected");

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "JOIN") {
      ws.username = message.username;
      handleJoin(ws);
    }

    if (message.type === "MOVE") {
      handleMove(ws, message.column);
    }

    if (message.type === "RECONNECT") {
      handleReconnect(ws, message.username);
    }
  });

  ws.on("close", () => {
    console.log(`${ws.username} disconnected`);
    handleDisconnect(ws);
  });
});

// =====================
// GAME LOGIC
// =====================
function handleJoin(ws) {
  console.log(`${ws.username} joined the queue`);
  waitingPlayers.push(ws);

  setTimeout(() => {
    if (waitingPlayers.includes(ws)) {
      waitingPlayers.splice(waitingPlayers.indexOf(ws), 1);
      startGame(ws, createBotPlayer());
    }
  }, 10000);

  if (waitingPlayers.length >= 2) {
    const p1 = waitingPlayers.shift();
    const p2 = waitingPlayers.shift();
    startGame(p1, p2);
  }
}

function startGame(player1, player2) {
  const gameId = uuidv4();

  const game = {
    id: gameId,
    board: createEmptyBoard(),
    players: [player1, player2],
    turn: 0,
    status: "ACTIVE",
  };

  activeGames.set(gameId, game);

  player1.gameId = gameId;
  player2.gameId = gameId;

  player1.send(JSON.stringify({ type: "GAME_START", player: 1 }));
  player2.send(JSON.stringify({ type: "GAME_START", player: 2 }));

  broadcastGameState(game);

  sendEvent("GAME_STARTED", {
    gameId,
    players: game.players.map((p) => p.username),
  });
}

function createBotPlayer() {
  return {
    username: "BOT",
    isBot: true,
    send: () => {},
  };
}

function handleMove(ws, column) {
  const game = activeGames.get(ws.gameId);
  if (!game || game.status !== "ACTIVE") return;

  if (game.players[game.turn] !== ws) return;

  const playerNumber = game.turn + 1;
  const row = dropDisc(game.board, column, playerNumber);
  if (row === -1) return;

  sendEvent("MOVE_PLAYED", {
    gameId: game.id,
    player: ws.username,
    column,
  });

  if (checkWin(game.board, playerNumber)) {
    game.status = "FINISHED";
    game.winner = ws.username;

    game.players.forEach((p) =>
      p.send(JSON.stringify({ type: "GAME_OVER", winner: ws.username }))
    );

    saveCompletedGame(game);
    return;
  }

  if (checkDraw(game.board)) {
    game.status = "FINISHED";
    game.winner = null;

    game.players.forEach((p) =>
      p.send(JSON.stringify({ type: "GAME_OVER", result: "DRAW" }))
    );

    saveCompletedGame(game);
    return;
  }

  game.turn = 1 - game.turn;
  broadcastGameState(game);

  if (game.players[game.turn].isBot) {
    setTimeout(() => handleBotMove(game), 500);
  }
}

function broadcastGameState(game) {
  const msg = JSON.stringify({
    type: "STATE_UPDATE",
    board: game.board,
    turn: game.turn + 1,
  });

  game.players.forEach((p) => p.send(msg));
}

function handleBotMove(game) {
  if (game.status !== "ACTIVE") return;

  const col = getBotMove(game.board);
  if (col === -1) return;

  dropDisc(game.board, col, 2);

  if (checkWin(game.board, 2)) {
    game.status = "FINISHED";
    game.winner = "BOT";

    game.players.forEach((p) =>
      p.send(JSON.stringify({ type: "GAME_OVER", winner: "BOT" }))
    );

    saveCompletedGame(game);
    return;
  }

  game.turn = 0;
  broadcastGameState(game);
}

function handleDisconnect(ws) {
  if (!ws.gameId) return;

  const game = activeGames.get(ws.gameId);
  if (!game || game.status !== "ACTIVE") return;

  const timer = setTimeout(() => {
    game.status = "FINISHED";
    const winner = game.players.find((p) => p.username !== ws.username);
    if (winner && !winner.isBot) {
      winner.send(
        JSON.stringify({
          type: "GAME_OVER",
          winner: winner.username,
          reason: "OPPONENT_DISCONNECTED",
        })
      );
    }
  }, 30000);

  reconnectTimers.set(ws.username, timer);
}

function handleReconnect(ws, username) {
  if (!reconnectTimers.has(username)) return;

  clearTimeout(reconnectTimers.get(username));
  reconnectTimers.delete(username);

  for (const game of activeGames.values()) {
    const idx = game.players.findIndex((p) => p.username === username);
    if (idx !== -1) {
      game.players[idx] = ws;
      ws.username = username;
      ws.gameId = game.id;

      ws.send(
        JSON.stringify({
          type: "STATE_UPDATE",
          board: game.board,
          turn: game.turn + 1,
        })
      );
      return;
    }
  }
}

// =====================
// START EVERYTHING
// =====================
initProducer()
  .then(() => console.log("Kafka producer ready"))
  .catch((err) => console.error("Kafka producer failed:", err.message));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
