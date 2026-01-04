const { saveCompletedGame, getLeaderboard } = require("./db");
const { initProducer, sendEvent } = require("./kafkaProducer");
const reconnectTimers = new Map(); // username -> timeout
const { getBotMove } = require('./botLogic');

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { createEmptyBoard, dropDisc, checkWin, checkDraw } = require('./gameEngine');

// Matchmaking queue
const waitingPlayers = [];

// Active games stored in memory
const activeGames = new Map();

const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket server running on ws://localhost:8080');

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'JOIN') {
            ws.username = message.username;
            handleJoin(ws);
        }
        if (message.type === 'MOVE') {
            handleMove(ws, message.column);
        }
        if (message.type === 'RECONNECT') {
            handleReconnect(ws, message.username);
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username} disconnected`);
        handleDisconnect(ws);
    });
});

//          FUNCTIONS

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
        const player1 = waitingPlayers.shift();
        const player2 = waitingPlayers.shift();
        startGame(player1, player2);
    }
}


function startGame(player1, player2) {
    const gameId = uuidv4();

    const game = {
        id: gameId,
        board: createEmptyBoard(),
        players: [player1, player2],
        turn: 0,
        status: 'ACTIVE'
    };

    activeGames.set(gameId, game);

    player1.gameId = gameId;
    player2.gameId = gameId;

    player1.send(JSON.stringify({ type: 'GAME_START', player: 1 }));
    player2.send(JSON.stringify({ type: 'GAME_START', player: 2 }));

    broadcastGameState(game);

    // Analytics: game started
    sendEvent("GAME_STARTED", {
        gameId: game.id,
        players: game.players.map(p => p.username),
    });

}

function createBotPlayer() {
    return {
        username: 'BOT',
        isBot: true,
        send: () => {} // bot doesn't need websocket
    };
}

    // handle move
function handleMove(ws, column) {
    const game = activeGames.get(ws.gameId);
    if (!game || game.status !== 'ACTIVE') return;

    const currentPlayer = game.players[game.turn];
    if (currentPlayer !== ws) return; // not your turn

    const playerNumber = game.turn + 1;
    const row = dropDisc(game.board, column, playerNumber);

    if (row === -1) return; // invalid move

    sendEvent("MOVE_PLAYED", {
        gameId: game.id,
        player: ws.username,
        column,
    });


    if (checkWin(game.board, playerNumber)) {
        game.status = 'FINISHED';

        game.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'GAME_OVER',
                winner: ws.username
            }));
        });

        // PERSIST COMPLETED GAME (WIN)
        game.winner = ws.username;
        saveCompletedGame(game);

        return;
    }

    if (checkDraw(game.board)) {
        game.status = 'FINISHED';

        game.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'GAME_OVER',
                winner: null,
                result: 'DRAW'
            }));
        });

        // 🧾 PERSIST COMPLETED GAME (DRAW)
        game.winner = null;
        saveCompletedGame(game);

        return;
    }

    game.turn = 1 - game.turn;
    broadcastGameState(game);

    // If next turn is bot, let bot play
    const nextPlayer = game.players[game.turn];
    if (nextPlayer.isBot) {
        setTimeout(() => handleBotMove(game), 500);
    }
    
}

function broadcastGameState(game) {
    const message = JSON.stringify({
        type: 'STATE_UPDATE',
        board: game.board,
        turn: game.turn + 1
    });

    game.players.forEach(player => {
        player.send(message);
    });
}

//  Bot Move Handler
function handleBotMove(game) {
    if (game.status !== 'ACTIVE') return;

    const botColumn = getBotMove(game.board);
    if (botColumn === -1) return;

    const row = dropDisc(game.board, botColumn, 2);
    if (row === -1) return;

    if (checkWin(game.board, 2)) {
        game.status = 'FINISHED';
        game.players.forEach(player => {
            player.send(JSON.stringify({
                type: 'GAME_OVER',
                winner: 'BOT'
            }));
        });
        console.log(`Game ${game.id} won by BOT`);
        return;
    }

    game.turn = 0;
    broadcastGameState(game);
}

function handleDisconnect(ws) {
    if (!ws.gameId) return;

    const game = activeGames.get(ws.gameId);
    if (!game || game.status !== 'ACTIVE') return;

    const username = ws.username;

    const timer = setTimeout(() => {
        game.status = 'FINISHED';

        const winner = game.players.find(p => p.username !== username);

        if (winner && !winner.isBot) {
            winner.send(JSON.stringify({
                type: 'GAME_OVER',
                winner: winner.username,
                reason: 'OPPONENT_DISCONNECTED'
            }));
        }

        console.log(`Game ${game.id} forfeited by ${username}`);
    }, 30000);

    reconnectTimers.set(username, timer);
}

function handleReconnect(ws, username) {
    if (!reconnectTimers.has(username)) return;

    clearTimeout(reconnectTimers.get(username));
    reconnectTimers.delete(username);

    // Find game
    for (const game of activeGames.values()) {
        const playerIndex = game.players.findIndex(p => p.username === username);
        if (playerIndex !== -1) {
            game.players[playerIndex] = ws;
            ws.username = username;
            ws.gameId = game.id;

            ws.send(JSON.stringify({
                type: 'STATE_UPDATE',
                board: game.board,
                turn: game.turn + 1
            }));

            console.log(`${username} reconnected to game ${game.id}`);
            return;
        }
    }
}

initProducer()
  .then(() => {
    console.log("Kafka producer ready");
  })
  .catch((err) => {
    console.error("Kafka producer failed:", err.message);
  });

  
const http = require("http");

const apiServer = http.createServer(async (req, res) => {
  // CORS HEADERS (THIS IS THE FIX)
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
  } else {
    res.writeHead(404);
    res.end();
  }
});


apiServer.listen(3001, () => {
  console.log("Leaderboard API running on http://localhost:3001/leaderboard");
});
