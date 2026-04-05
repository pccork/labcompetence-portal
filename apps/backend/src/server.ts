import cors from "@fastify/cors";
import Fastify from "fastify";

import { env } from "./config/env";
import postgresPlugin from "./plugins/postgres";
import authPlugin from "./plugins/auth";
import emailPlugin from "./plugins/email";
import authRoutes from "./routes/auth";
import hospitalRoutes from "./routes/hospitals";
import labRoutes from "./routes/labs";
import pocRegistrationRoutes from "./routes/poc-registration";
import templateRoutes from "./routes/templates";
import trainingAssignmentRoutes from "./routes/training-assignments";
import trainingRecordRoutes from "./routes/training-records";
import userLabRoutes from "./routes/user-labs";
import userRoutes from "./routes/users";
import { Role } from "shared-types";



export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(postgresPlugin);
  await app.register(authPlugin);
  await app.register(emailPlugin);
  await app.register(authRoutes);
  await app.register(hospitalRoutes);
  await app.register(userRoutes);
  await app.register(labRoutes);
  await app.register(pocRegistrationRoutes);
  await app.register(templateRoutes);
  await app.register(trainingAssignmentRoutes);
  await app.register(trainingRecordRoutes);
  await app.register(userLabRoutes);

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

    app.get(
      "/admin",
      {
        preHandler: [app.authenticate, app.requireRole(Role.ADMIN)],
      },
      async () => {
        return { message: "Admin only route" 

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
