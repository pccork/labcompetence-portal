import "@fastify/jwt";
import { FastifyPluginAsync } from "fastify";
import bcrypt from "bcrypt";

import { env } from "../config/env";
import {
  findUserByEmail,
  findUserById,
} from "../services/user-service";
import { exchangeMicrosoftCodeForProfile } from "../services/microsoft-auth-service";

function signAppToken(fastify: any, user: any) {
  return fastify.jwt.sign({
    id: user.id.toString(),
    email: user.email,
    role: user.role,
  });
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/auth/providers", async () => {
    return {
      local: {
        enabled: env.AUTH_LOCAL_ENABLED,
      },
      microsoft: {
        enabled:
          env.AUTH_MICROSOFT_ENABLED &&
          Boolean(env.MICROSOFT_CLIENT_ID) &&
          Boolean(env.MICROSOFT_TENANT_ID),
        clientId: env.MICROSOFT_CLIENT_ID ?? null,
        tenantId: env.MICROSOFT_TENANT_ID ?? null,
        allowedEmailDomain: env.MICROSOFT_ALLOWED_EMAIL_DOMAIN ?? null,
      },
    };
  });

  fastify.post("/login", async (request: any, reply) => {
    if (!env.AUTH_LOCAL_ENABLED) {
      return reply.status(403).send({
        message: "Email/password sign-in is disabled",
      });
    }

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

    const token = signAppToken(fastify, user);

    return { token };
  });

  fastify.post(
    "/auth/microsoft/login",
    async (request: any, reply) => {
      if (!env.AUTH_MICROSOFT_ENABLED) {
        return reply.status(403).send({
          message: "Microsoft sign-in is disabled",
        });
      }

      const { code, codeVerifier, redirectUri } = request.body ?? {};

      if (!code || !codeVerifier || !redirectUri) {
        return reply.status(400).send({
          message: "Microsoft sign-in requires code, codeVerifier, and redirectUri",
        });
      }

      try {
        const microsoftProfile = await exchangeMicrosoftCodeForProfile({
          code,
          codeVerifier,
          redirectUri,
        });

        const user = await findUserByEmail(fastify.db, microsoftProfile.email);

        if (!user) {
          return reply.status(401).send({
            message:
              "Your Microsoft account is not linked to an active Lab Competence Portal user",
          });
        }

        const token = signAppToken(fastify, user);

        return { token };
      } catch (error) {
        return reply.status(401).send({
          message:
            error instanceof Error
              ? error.message
              : "Microsoft sign-in failed",
        });
      }
    }
  );

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
