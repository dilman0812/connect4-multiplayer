# 🎮 4 in a Row — Real-Time Multiplayer Game

A real-time multiplayer **4 in a Row (Connect Four)** game built with **Node.js**, **WebSockets**, **React**, **PostgreSQL**, and **Kafka-compatible analytics**.

This project demonstrates **real-time systems**, **event-driven architecture**, **state management**, and **backend reliability patterns**.

## 🧠 Features Overview

### Core Gameplay
- 7×6 Connect Four board
- Real-time **1v1 gameplay**
- Player vs Player or Player vs **Competitive Bot**
- Correct win & draw detection

### Real-Time System
- WebSocket-based turn updates
- Instant board synchronization
- Reconnect within **30 seconds**
- Automatic forfeit on timeout

### Competitive Bot
- Non-random gameplay
- Blocks opponent’s winning moves
- Attempts its own winning paths

### Persistence & Analytics
- Active games stored **in memory**
- Completed games persisted in **PostgreSQL** (local environment)
- Event-driven analytics via **Kafka-compatible streaming**
- Leaderboard derived from persisted game results

## 🏗 Architecture & Design

The system is designed around **real-time communication**, **low-latency state handling**, and **decoupled analytics**.

- The **Frontend (React)** communicates with the backend using **WebSockets** to receive instant game updates.
- The **Backend (Node.js)** manages matchmaking, game state, turn logic, bot behavior, and reconnection handling.
- **Active games** are stored **in memory** for fast access during gameplay.
- When a game ends, a summary record is persisted to **PostgreSQL** for durability.
- The backend also emits **game lifecycle events** to a Kafka-compatible broker.
- A separate **Analytics Consumer** processes these events asynchronously to compute gameplay metrics.

This separation ensures that real-time gameplay is never blocked by analytics or persistence workloads.


```text
┌────────────┐        WebSocket        ┌────────────┐
│  Frontend  │  <------------------>  │  Backend   │
│  (React)   │                        │ (Node.js)  │
└────────────┘                        └─────┬──────┘
                                             │
                                   Game End  │
                                             ▼
                                       ┌──────────┐
                                       │ Postgres │
                                       │ (Local)  │
                                       └──────────┘
                                             │
                               Kafka Events  │
                                             ▼
                                  ┌────────────────┐
                                  │ Analytics       │
                                  │ Consumer        │
                                  └────────────────┘

```

## 🧾 Game State Handling

- **Active games** are maintained in memory to ensure low-latency real-time play.
- Each active game tracks the board state, players, turn, and status.
- If a player disconnects, the game remains in memory for **30 seconds**, allowing reconnection.
- If the player does not reconnect within the timeout window, the game is forfeited.

### Completed Games Persistence
- When a game finishes (win or draw), a summary record is persisted to **PostgreSQL**.
- Stored fields include game ID, players, winner (or draw), and timestamp.
- This ensures completed games are durable and available for analytics and leaderboard computation.

## 🏅 Leaderboard

- The leaderboard tracks the **number of wins per player**.
- Data is derived from persisted game records in PostgreSQL.
- A read-only HTTP endpoint (`/leaderboard`) exposes aggregated results.
- The frontend fetches and displays the leaderboard automatically after each game.
- In the cloud deployment, the leaderboard endpoint returns an empty list due to the absence of a database.

## 💥 Analytics (Kafka)

The system implements **decoupled game analytics** using a Kafka-compatible event streaming platform.

### Events Emitted
The backend emits the following events:
- `GAME_STARTED`
- `MOVE_PLAYED`
- `GAME_ENDED`

Each event includes metadata such as timestamp, game ID, and relevant payload.

### Implementation Notes
- Kafka integration is implemented using **KafkaJS**.
- For local development, **Redpanda** is used as a Kafka-compatible broker.
- The game server acts as a **producer**, emitting events asynchronously.
- A separate **Analytics Consumer** subscribes to these events and processes them independently.

This design ensures analytics workloads do not impact real-time gameplay performance.

> Redpanda is fully Kafka API compatible. The same producer and consumer code can run on Apache Kafka or managed Kafka services in production without changes.

## 🛠 Tech Stack

### Backend
- Node.js
- WebSockets (`ws`)
- PostgreSQL
- KafkaJS
- Redpanda (Kafka-compatible broker)

### Frontend
- React
- Basic CSS / inline styling

### Infrastructure
- Docker
- Docker Compose

## 📂 Project Structure

```text
connect4-multiplayer/
├── backend/        # Game server, WebSocket handling, DB, HTTP APIs
├── frontend/       # React UI
├── analytics/      # Kafka analytics consumer
├── docker-compose.yml
└── README.md
```

## 🌐 Cloud Deployment Notes

The application is deployed on Render for demonstration purposes.

- The **backend and frontend are live** and fully functional.
- **PostgreSQL and Kafka are used in the local environment**.
- In the cloud deployment:
  - PostgreSQL is not provisioned.
  - Kafka producers are automatically disabled via environment detection.
  - The leaderboard API gracefully returns an empty list when the database is unavailable.

This design keeps the deployed application **stateless, stable, and demo-friendly**, while preserving full persistence and analytics capabilities in local development.

## 🌍 Live Demo

- **Frontend (React UI):** https://connect4-multiplayer-1.onrender.com
- **Backend (WebSocket + API):** https://connect4-multiplayer-h1sc.onrender.com
- **Leaderboard API:** https://connect4-multiplayer-h1sc.onrender.com/leaderboard


## 🚀 How to Run Locally

### 1️⃣ Start Infrastructure (Kafka + Postgres)

```bash
docker-compose up -d
```

Ensure the following containers are running:
- `redpanda`
- `connect4-postgres`

---

### 2️⃣ Start Backend

```bash
cd backend
npm install
node server.js
```

Expected logs:
```
Server running on port 8080
Kafka producer ready
```

---

### 3️⃣ Start Analytics Consumer

```bash
cd analytics
npm install
node consumer.js
```

---

### 4️⃣ Start Frontend

```bash
cd frontend
npm install
npm start
```

Open in browser:
```
http://localhost:3000
```

## 🧪 Testing the System

1. Open the frontend in the browser.
2. Enter a username and join a game.
3. Play against another player or wait for the bot.
4. Complete a game (win or draw).
5. Verify:
   - Game result is shown immediately.
   - Leaderboard updates automatically.
   - Analytics events appear in the consumer logs.
   - Game record is persisted in PostgreSQL (local environment).

---

## 📌 Design Decisions

- **In-memory state for active games**  
  Ensures low-latency gameplay and fast turn updates.

- **PostgreSQL for completed games**  
  Guarantees durability and supports leaderboard queries.

- **Event-driven analytics**  
  Analytics are decoupled from gameplay using Kafka-compatible streaming, preventing performance impact.

- **Redpanda for local Kafka**  
  Simplifies local setup while remaining fully Kafka API compatible.

- **Minimal frontend styling**  
  Focused on functionality and system design rather than UI polish.

---

## ✅ Assignment Coverage

| Requirement | Status |
|------------|--------|
| Real-time multiplayer | ✅ |
| Player vs Player | ✅ |
| Competitive Bot | ✅ |
| WebSockets | ✅ |
| Reconnect handling | ✅ |
| In-memory game state | ✅ |
| Persistent storage | ✅ |
| Leaderboard | ✅ |
| Kafka analytics | ✅ |

---

## 👤 Author

**Dilman Sandhu**
