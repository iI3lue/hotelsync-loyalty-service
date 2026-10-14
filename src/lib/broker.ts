import amqplib, { ChannelModel, ConfirmChannel } from "amqplib";

const EXCHANGE = "hotelsync.events";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";

let connection: ChannelModel | null = null;
let confirmChannel: ConfirmChannel | null = null;
let connecting: Promise<ConfirmChannel> | null = null;

export async function connect(): Promise<ConfirmChannel> {
  if (confirmChannel) return confirmChannel;

  connecting ??= (async () => {
    let attempt = 0;
    for (;;) {
      try {
        const conn = await amqplib.connect(RABBITMQ_URL);
        connection = conn;
        conn.on("error", () => {});
        conn.on("close", async () => {
          connection = null;
          confirmChannel = null;
          connecting = null;
          await new Promise(res => setTimeout(res, 1000));
          void connect();
        });

        const channel = await conn.createConfirmChannel();
        await channel.assertExchange(EXCHANGE, "topic", { durable: true });
        confirmChannel = channel;
        return channel;
      } catch (err) {
        attempt += 1;
        console.warn(`[broker] Reintento de conexión a RabbitMQ (${attempt})...`);
        await new Promise(res => setTimeout(res, Math.min(1000 * 2 ** (attempt - 1), 15000)));
      }
    }
  })();
  return connecting;
}