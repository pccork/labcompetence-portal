import { FastifyPluginAsync } from "fastify";
import { Role } from "shared-types";

import {
  createLab,
  deleteLab,
  listLabs,
  updateLab,
} from "../services/lab-service";

interface CreateLabBody {
  Body: {
    name?: string;
  };
}

interface LabParams {
  Params: {
    id: string;
  };
}

const labRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/labs", async () => {
    const labs = await listLabs(fastify.db);

    return { labs };
  });

  fastify.post<CreateLabBody>(
    "/labs",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const name = request.body?.name?.trim();

      if (!name) {
        return reply.status(400).send({ message: "Lab name is required" });
      }

      try {
        const lab = await createLab(fastify.db, name);

        return reply.status(201).send({ lab });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply
            .status(409)
            .send({ message: "Lab already exists" });
        }

        throw error;
      }
    }
  );

  fastify.put<LabParams & CreateLabBody>(
    "/labs/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const labId = Number(request.params.id);
      const name = request.body?.name?.trim();

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      if (!name) {
        return reply.status(400).send({ message: "Lab name is required" });
      }

      try {
        const lab = await updateLab(fastify.db, labId, name);

        if (!lab) {
          return reply.status(404).send({ message: "Lab not found" });
        }

        return { lab };
      } catch (error: any) {
        if (error.code === "23505") {
          return reply
            .status(409)
            .send({ message: "Lab already exists" });
        }

        throw error;
      }
    }
  );

  fastify.delete<LabParams>(
    "/labs/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const labId = Number(request.params.id);

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      try {
        const lab = await deleteLab(fastify.db, labId);

        if (!lab) {
          return reply.status(404).send({ message: "Lab not found" });
        }

        return { lab };
      } catch (error: any) {
        if (error.code === "23503") {
          return reply.status(409).send({
            message: "Lab cannot be deleted while related records exist",
          });
        }

        throw error;
      }
    }
  );
};

export default labRoutes;
