import Fastify from "fastify";

import { env } from "./config/env";
import mongoPlugin from "./plugins/mongo";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";



export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(mongoPlugin);
  await app.register(authPlugin);
  await app.register(authRoutes);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get(
  "/protected",
  { preHandler: app.authenticate },
  async (request) => {
    return {
      message: "Authenticated",
      user: request.user,
    };
  }
);


  return app;
}

async function start() {
  try {
    const app = await buildServer();

    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    console.log(`🚀 Server listening at http://localhost:${env.PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
