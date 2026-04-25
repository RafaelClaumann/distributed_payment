const amqp = require("amqplib");

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://admin:admin@localhost:5672";

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
  const ch = await getChannel();
  ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
  console.log(`[RabbitMQ] [${payload.transaction_id}] Publicado em ${queue}`);
}

async function publishToPaymentDlq(payload) {
  await publish(process.env.PAYMENT_DLQ_QUEUE_NAME, {
    ...payload,
    failed_at: new Date().toISOString(),
  });
  console.warn(`[RabbitMQ] [${payload.transaction_id}] Mensagem enviada para DLQ`);
}

module.exports = { publish, publishToPaymentDlq, getChannel };
