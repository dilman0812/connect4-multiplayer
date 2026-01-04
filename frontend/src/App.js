import React, { useState, useEffect } from "react";

function App() {
  const [username, setUsername] = useState("");
  const [ws, setWs] = useState(null);
  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState(null);
  const [status, setStatus] = useState("Not connected");
  const [leaderboard, setLeaderboard] = useState([]);

  // Fetch leaderboard from backend
  const loadLeaderboard = async () => {
    try {
      const res = await fetch("http://localhost:3001/leaderboard");
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    }
  };

  // LOAD LEADERBOARD ON PAGE LOAD
  useEffect(() => {
    loadLeaderboard();
  }, []);

  const connect = () => {
    if (!username) return alert("Enter username");

    const socket = new WebSocket("ws://localhost:8080");

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

        // Reload leaderboard after game ends
        loadLeaderboard();
      }
    };

    setWs(socket);
  };

  const makeMove = (col) => {
    if (!ws) return;
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
