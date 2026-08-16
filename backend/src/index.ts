import "dotenv/config";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { createApp } from "./server.js";

async function bootstrap(): Promise<void> {
  await connectDB();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[server] FlavorAI API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  console.error("[server] Failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});