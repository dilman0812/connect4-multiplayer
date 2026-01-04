const { Kafka } = require("kafkajs");

let producer = null;
let kafkaEnabled = false;

async function initProducer() {
  // Disable Kafka on Render
  if (process.env.RENDER === "true") {
    console.log("Kafka disabled on Render environment");
    return;
  }

  kafkaEnabled = true;

  const kafka = new Kafka({
    clientId: "game-server",
    brokers: ["localhost:9092"],
  });

  producer = kafka.producer();
  await producer.connect();
}

async function sendEvent(type, payload) {
  if (!kafkaEnabled || !producer) return;

  await producer.send({
    topic: "game-events",
    messages: [
      {
        value: JSON.stringify({
          type,
          payload,
          timestamp: Date.now(),
        }),
      },
    ],
  });
}

module.exports = { initProducer, sendEvent };
