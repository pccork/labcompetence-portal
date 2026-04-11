import { FastifyPluginAsync } from "fastify";

import trainingAssignmentController from "../controllers/training-assignment-controller";

const trainingAssignmentRoutes: FastifyPluginAsync = async (fastify) => {
  await trainingAssignmentController(fastify, {});
};

export default trainingAssignmentRoutes;
