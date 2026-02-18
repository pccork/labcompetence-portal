import { MongoClient } from "mongodb";
import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";

import { env } from "../config/env";

declare module "fastify" {
  interface FastifyInstance {
    mongo: MongoClient;
  }
}

const mongoPlugin: FastifyPluginAsync = async (fastify) => {
  const client = new MongoClient(env.MONGO_URI);

  await client.connect();

  fastify.decorate("mongo", client);

  fastify.addHook("onClose", async () => {
    await client.close();
  });
};

export default fp(mongoPlugin);
