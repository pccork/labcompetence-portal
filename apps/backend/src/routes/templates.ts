import { FastifyPluginAsync } from "fastify";

import templateController from "../controllers/template-controller";

const templateRoutes: FastifyPluginAsync = async (fastify) => {
  await templateController(fastify, {});
};

export default templateRoutes;
