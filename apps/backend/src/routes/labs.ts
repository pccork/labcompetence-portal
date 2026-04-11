import { FastifyPluginAsync } from "fastify";

import labController from "../controllers/lab-controller";

const labRoutes: FastifyPluginAsync = async (fastify) => {
  await labController(fastify, {});
};

export default labRoutes;
