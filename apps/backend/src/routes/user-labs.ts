import { FastifyPluginAsync } from "fastify";

import userLabController from "../controllers/user-lab-controller";

const userLabRoutes: FastifyPluginAsync = async (fastify) => {
  await userLabController(fastify, {});
};

export default userLabRoutes;
