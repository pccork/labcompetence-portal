import { FastifyPluginAsync } from "fastify";

import pocRegistrationController from "../controllers/poc-registration-controller";

const pocRegistrationRoutes: FastifyPluginAsync = async (fastify) => {
  await pocRegistrationController(fastify, {});
};

export default pocRegistrationRoutes;
