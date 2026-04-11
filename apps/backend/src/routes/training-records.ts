import { FastifyPluginAsync } from "fastify";

import trainingRecordController from "../controllers/training-record-controller";

const trainingRecordRoutes: FastifyPluginAsync = async (fastify) => {
  await trainingRecordController(fastify, {});
};

export default trainingRecordRoutes;
