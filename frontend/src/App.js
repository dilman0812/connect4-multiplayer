import React, { useState, useEffect } from "react";

const BACKEND_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:8080"
    : "https://connect4-multiplayer-h1sc.onrender.com";

const WS_URL =
  window.location.hostname === "localhost"
    ? "ws://localhost:8080"
    : "wss://connect4-multiplayer-h1sc.onrender.com";

function App() {
  const [username, setUsername] = useState("");
  const [ws, setWs] = useState(null);
  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState(null);
  const [status, setStatus] = useState("Not connected");
  const [leaderboard, setLeaderboard] = useState([]);

  // -----------------------
  // LOAD LEADERBOARD
  // -----------------------
  const loadLeaderboard = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/leaderboard`);
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // -----------------------
  // CONNECT WEBSOCKET
  // -----------------------
  const connect = () => {
    if (!username) {
      alert("Enter username");
      return;
    }

    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "JOIN", username }));
      setStatus("Waiting for opponent...");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "GAME_START") {
        setStatus("Game started");
      }

      if (data.type === "STATE_UPDATE") {
        setBoard(data.board);
        setTurn(data.turn);
      }

      if (data.type === "GAME_OVER") {
        if (data.result === "DRAW") {
          setStatus("Game ended in a draw");
        } else {
          setStatus(`Winner: ${data.winner}`);
        }
        loadLeaderboard();
      }
    };

    socket.onerror = () => {
      setStatus("Connection error");
    };

    socket.onclose = () => {
      setStatus("Disconnected");
      setWs(null);
    };

    setWs(socket);
  };

  // -----------------------
  // SEND MOVE
  // -----------------------
  const makeMove = (col) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "MOVE", column: col }));
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>4 in a Row</h2>

      {!ws && (
        <>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button onClick={connect}>Join Game</button>
        </>
      )}

      <p>{status}</p>

      {board &&
        board.map((row, r) => (
          <div key={r} style={{ display: "flex" }}>
            {row.map((cell, c) => (
              <button
                key={c}
                onClick={() => makeMove(c)}
                style={{
                  width: 40,
                  height: 40,
                  margin: 2,
                  background:
                    cell === 1
                      ? "red"
                      : cell === 2
                      ? "yellow"
                      : "lightgray",
                }}
              />
            ))}
          </div>
        ))}

      {turn && <p>Turn: Player {turn}</p>}

      <h3>Leaderboard</h3>
      {leaderboard.length === 0 ? (
        <p>No games yet</p>
      ) : (
        <ul>
          {leaderboard.map((row, idx) => (
            <li key={idx}>
              {row.winner}: {row.wins} wins
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
