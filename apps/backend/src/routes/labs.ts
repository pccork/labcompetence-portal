import { FastifyPluginAsync } from "fastify";
import { Role } from "shared-types";

import {
  canAccessHospital,
  getHospitalAccessScope,
} from "../services/access-policy-service";
import { findHospitalById } from "../services/hospital-service";
import {
  createLab,
  deleteLab,
  findLabById,
  listLabs,
  updateLab,
} from "../services/lab-service";

interface CreateLabBody {
  Body: {
    hospitalId?: number;
    name?: string;
    isPoc?: boolean;
  };
}

interface LabParams {
  Params: {
    id: string;
  };
}

const labRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/labs",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const labs = await listLabs(
        fastify.db,
        scope.canAccessAllHospitals ? undefined : scope.homeHospitalId
      );

      return { labs };
    }
  );

  fastify.post<CreateLabBody>(
    "/labs",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const hospitalId = Number(request.body?.hospitalId);
      const name = request.body?.name?.trim();
      const isPoc = request.body?.isPoc ?? false;

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply
          .status(400)
          .send({ message: "Valid hospitalId is required" });
      }

      if (!name) {
        return reply.status(400).send({ message: "Lab name is required" });
      }

      const hospital = await findHospitalById(fastify.db, hospitalId);

      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!canAccessHospital(scope, hospitalId)) {
        return reply.status(403).send({
          message: "You cannot create labs for this hospital",
        });
      }

      try {
        const lab = await createLab(
          fastify.db,
          hospitalId,
          name,
          isPoc
        );

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
      const hospitalId = Number(request.body?.hospitalId);
      const name = request.body?.name?.trim();
      const isPoc = request.body?.isPoc ?? false;

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply
          .status(400)
          .send({ message: "Valid hospitalId is required" });
      }

      if (!name) {
        return reply.status(400).send({ message: "Lab name is required" });
      }

      const hospital = await findHospitalById(fastify.db, hospitalId);

      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const existingLab = await findLabById(fastify.db, labId);

      if (!existingLab) {
        return reply.status(404).send({ message: "Lab not found" });
      }

      if (
        !canAccessHospital(scope, existingLab.hospital_id) ||
        !canAccessHospital(scope, hospitalId)
      ) {
        return reply.status(403).send({
          message: "You cannot update labs across this hospital boundary",
        });
      }

      try {
        const lab = await updateLab(
          fastify.db,
          labId,
          hospitalId,
          name,
          isPoc
        );

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
        const scope = await getHospitalAccessScope(
          fastify.db,
          Number(request.user.id)
        );

        if (!scope) {
          return reply.status(404).send({ message: "User not found" });
        }

        const existingLab = await findLabById(fastify.db, labId);

        if (!existingLab) {
          return reply.status(404).send({ message: "Lab not found" });
        }

        if (!canAccessHospital(scope, existingLab.hospital_id)) {
          return reply.status(403).send({
            message: "You cannot delete labs from this hospital",
          });
        }

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
