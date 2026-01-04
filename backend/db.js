const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "connect4",
  password: "connect4",
  database: "connect4",
});

async function saveCompletedGame(game) {
  const player1 = game.players[0].username;
  const player2 = game.players[1].username;
  const winner = game.winner || "DRAW";

  await pool.query(
    `INSERT INTO games (id, player1, player2, winner)
     VALUES ($1, $2, $3, $4)`,
    [game.id, player1, player2, winner]
  );
}

module.exports = {
  saveCompletedGame,
  getLeaderboard
};


async function getLeaderboard() {
  const result = await pool.query(`
    SELECT winner, COUNT(*) AS wins
    FROM games
    WHERE winner IS NOT NULL
    GROUP BY winner
    ORDER BY wins DESC
  `);

  return result.rows;
}
