import { FastifyPluginAsync } from "fastify";

import hospitalController from "../controllers/hospital-controller";

const hospitalRoutes: FastifyPluginAsync = async (fastify) => {
  await hospitalController(fastify, {});
};

export default hospitalRoutes;
