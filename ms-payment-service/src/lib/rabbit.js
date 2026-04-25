const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://admin:admin@localhost:5672";

let channel;

async function getChannel() {
  if (channel) return channel;
  const conn = await amqp.connect(RABBITMQ_URL);
  channel = await conn.createChannel();

  conn.on("error", (err) => {
    console.error("[RabbitMQ] Conexão perdida:", err.message);
    channel = null;
  });

  console.log("[RabbitMQ] Conectado");
  return channel;
}

async function publish(queue, payload) {
  const channel = await getChannel();
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true });
}

async function publishToPaymentDlq(payload) {
  await publish(process.env.PAYMENT_DLQ_QUEUE_NAME, { ...payload, failed_at: new Date().toISOString() });
}

module.exports = { publish, publishToPaymentDlq, getChannel };
