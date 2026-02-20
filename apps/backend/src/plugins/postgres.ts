import { Pool } from "pg";
import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { env } from "../config/env";

declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
  }
}

const postgresPlugin: FastifyPluginAsync = async (fastify) => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  fastify.decorate("db", pool);

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
};

export default fp(postgresPlugin);