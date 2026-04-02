import { FastifyPluginAsync } from "fastify";
import { Role } from "shared-types";

import { findLabById } from "../services/lab-service";
import { findUserById } from "../services/user-service";
import {
  assignUserToLab,
  listLabsForUser,
  removeUserFromLab,
} from "../services/user-lab-service";

interface UserParams {
  Params: {
    userId: string;
  };
}

interface UserLabParams {
  Params: {
    userId: string;
    labId: string;
  };
}

const userLabRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<UserParams>(
    "/users/:userId/labs",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.userId);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

      const user = await findUserById(fastify.db, userId);

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      const labs = await listLabsForUser(fastify.db, userId);

      return { user, labs };
    }
  );

  fastify.post<UserLabParams>(
    "/users/:userId/labs/:labId",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.userId);
      const labId = Number(request.params.labId);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      const [user, lab] = await Promise.all([
        findUserById(fastify.db, userId),
        findLabById(fastify.db, labId),
      ]);

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!lab) {
        return reply.status(404).send({ message: "Lab not found" });
      }

      try {
        const assignment = await assignUserToLab(
          fastify.db,
          userId,
          labId
        );

        return reply.status(201).send({ assignment });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply
            .status(409)
            .send({ message: "User is already assigned to this lab" });
        }

        throw error;
      }
    }
  );

  fastify.delete<UserLabParams>(
    "/users/:userId/labs/:labId",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.userId);
      const labId = Number(request.params.labId);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      const [user, lab] = await Promise.all([
        findUserById(fastify.db, userId),
        findLabById(fastify.db, labId),
      ]);

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!lab) {
        return reply.status(404).send({ message: "Lab not found" });
      }

      const assignment = await removeUserFromLab(
        fastify.db,
        userId,
        labId
      );

      if (!assignment) {
        return reply.status(404).send({
          message: "User is not assigned to this lab",
        });
      }

      return { assignment };
    }
  );
};

export default userLabRoutes;
