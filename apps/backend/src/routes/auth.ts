import "@fastify/jwt";
import { FastifyPluginAsync } from "fastify";
import bcrypt from "bcrypt";

import { findUserByEmail } from "../services/user-service";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/login", async (request: any, reply) => {
    const { email, password } = request.body;

    const db = fastify.mongo.db();
    const user = await findUserByEmail(db, email);

    if (!user) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = fastify.jwt.sign({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    return { token };
  });
};

export default authRoutes;
