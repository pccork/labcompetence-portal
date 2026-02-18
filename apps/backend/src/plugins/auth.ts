import bcrypt from "bcrypt";
import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";

import { env } from "../config/env";
import { Role } from "shared-types";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }

  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      role: Role;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(require("@fastify/jwt"), {
    secret: env.JWT_SECRET,
  });

  fastify.decorate(
    "authenticate",
    async function (request: any, reply: any) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    },
  );
};

export default fp(authPlugin);
