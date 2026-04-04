import "@fastify/jwt";
import { FastifyPluginAsync } from "fastify";
import bcrypt from "bcrypt";

import {
  findUserByEmail,
  findUserById,
} from "../services/user-service";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/login", async (request: any, reply) => {
    const { email, password } = request.body;

    const db = fastify.db;
    const user = await findUserByEmail(db, email);

    if (!user) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = fastify.jwt.sign({
      id: user.id.toString(),
      email: user.email,
      role: user.role,
    });

    return { token };
  });

  fastify.get(
    "/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const userId = Number(request.user.id);
      const user = await findUserById(fastify.db, userId);

      if (!user || !user.is_active) {
        return reply.status(404).send({ message: "User not found" });
      }

      return { user };
    }
  );
};

export default authRoutes;
