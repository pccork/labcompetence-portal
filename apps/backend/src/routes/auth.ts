import { FastifyPluginAsync } from "fastify";

import authController from "../controllers/auth-controller";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  await authController(fastify, {});
};

export default authRoutes;
