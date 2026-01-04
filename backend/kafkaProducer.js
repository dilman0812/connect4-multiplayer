const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "game-server",
  brokers: ["localhost:9092"], // Redpanda / Kafka
});

const producer = kafka.producer();

async function initProducer() {
  await producer.connect();
  console.log("Kafka producer connected");
}

async function sendEvent(eventType, payload) {

  await producer.send({
    topic: "game-events",
    messages: [
      {
        value: JSON.stringify({
          eventType,
          timestamp: Date.now(),
          payload,
        }),
      },
    ],
  });
}

module.exports = {
  initProducer,
  sendEvent,
};
