const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "analytics-service",
  brokers: ["localhost:9092"], // Redpanda
});

const consumer = kafka.consumer({ groupId: "analytics-group" });

const stats = {
  gamesStarted: 0,
  gamesEnded: 0,
  wins: {},
};

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: "game-events", fromBeginning: true });

  console.log("Analytics consumer running...");

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());

      console.log("EVENT:", event);

      if (event.eventType === "GAME_STARTED") {
        stats.gamesStarted++;
      }

      if (event.eventType === "GAME_ENDED") {
        stats.gamesEnded++;
        const winner = event.payload.winner;
        stats.wins[winner] = (stats.wins[winner] || 0) + 1;
      }

      console.log("STATS:", stats);
    },
  });
}

run().catch(console.error);
