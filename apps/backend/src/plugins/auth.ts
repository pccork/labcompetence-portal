import "@fastify/jwt";
import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";

import { env } from "../config/env";
import { Role } from "shared-types";

interface JwtPayload {
  id: string;
  email: string;
  role: Role;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
    requireRole: (role: Role) => any;
    requireAnyRole: (roles: Role[]) => any;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  fastify.decorate(
    "authenticate",
    async function (
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ message: "Unauthorized" });
      }
    }
  );

  fastify.decorate("requireRole", function (role: Role) {
    return async function (
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      if (request.user.role !== role) {
        return reply.status(403).send({ message: "Forbidden" });
      }
    };
  });

  fastify.decorate("requireAnyRole", function (roles: Role[]) {
    return async function (
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      if (!roles.includes(request.user.role)) {
        return reply.status(403).send({ message: "Forbidden" });
      }
    };
  });
};

export default fp(authPlugin);
