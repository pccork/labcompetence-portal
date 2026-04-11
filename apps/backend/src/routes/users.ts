import { FastifyPluginAsync } from "fastify";

import userController from "../controllers/user-controller";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  await userController(fastify, {});
};

export default userRoutes;
