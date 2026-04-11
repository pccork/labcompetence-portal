import { FastifyPluginAsync } from "fastify";

import departmentController from "../controllers/department-controller";

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  await departmentController(fastify, {});
};

export default departmentRoutes;
