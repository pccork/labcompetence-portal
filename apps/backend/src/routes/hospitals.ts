import { FastifyPluginAsync } from "fastify";
import { Role } from "shared-types";

import {
  canAccessHospital,
  getHospitalAccessScope,
  resolveScopedHospitalId,
} from "../services/access-policy-service";
import {
  createHospital,
  deleteHospital,
  findHospitalById,
  listHospitals,
  updateHospital,
} from "../services/hospital-service";
import { maybeAutoSyncPrivateSeed } from "../services/private-seed-sync-service";

interface HospitalParams {
  Params: {
    id: string;
  };
}

interface HospitalBody {
  Body: {
    name?: string;
  };
}

const hospitalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/hospitals",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([Role.ADMIN, Role.TRAINER, Role.STAFF]),
      ],
    },
    async (request, reply) => {
      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const hospitals = await listHospitals(
        fastify.db,
        resolveScopedHospitalId(scope),
      );

      return { hospitals };
    },
  );

  fastify.get<HospitalParams>(
    "/hospitals/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([Role.ADMIN, Role.TRAINER, Role.STAFF]),
      ],
    },
    async (request, reply) => {
      const hospitalId = Number(request.params.id);

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply.status(400).send({ message: "Invalid hospital id" });
      }

      const hospital = await findHospitalById(fastify.db, hospitalId);

      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!canAccessHospital(scope, hospital.id)) {
        return reply.status(403).send({
          message: "You cannot access this hospital",
        });
      }

      return { hospital };
    },
  );

  fastify.post<HospitalBody>(
    "/hospitals",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const name = request.body.name?.trim();

      if (!name) {
        return reply.status(400).send({ message: "Hospital name is required" });
      }

      try {
        const scope = await getHospitalAccessScope(
          fastify.db,
          Number(request.user.id),
        );

        if (!scope) {
          return reply.status(404).send({ message: "User not found" });
        }

        if (!scope.canAccessAllHospitals) {
          return reply.status(403).send({
            message: "Only a global admin can create new hospitals",
          });
        }

        const hospital = await createHospital(fastify.db, name);

        await maybeAutoSyncPrivateSeed(fastify.db);

        return reply.status(201).send({ hospital });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply.status(409).send({ message: "Hospital already exists" });
        }

        throw error;
      }
    },
  );

  fastify.put<HospitalParams & HospitalBody>(
    "/hospitals/:id",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const hospitalId = Number(request.params.id);
      const name = request.body.name?.trim();

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply.status(400).send({ message: "Invalid hospital id" });
      }

      if (!name) {
        return reply.status(400).send({ message: "Hospital name is required" });
      }

      try {
        const scope = await getHospitalAccessScope(
          fastify.db,
          Number(request.user.id),
        );

        if (!scope) {
          return reply.status(404).send({ message: "User not found" });
        }

        if (!canAccessHospital(scope, hospitalId)) {
          return reply.status(403).send({
            message: "You cannot update this hospital",
          });
        }

        if (!scope.canAccessAllHospitals) {
          return reply.status(403).send({
            message: "Only a global admin can update hospitals",
          });
        }

        const hospital = await updateHospital(fastify.db, hospitalId, name);

        if (!hospital) {
          return reply.status(404).send({ message: "Hospital not found" });
        }

        await maybeAutoSyncPrivateSeed(fastify.db);

        return { hospital };
      } catch (error: any) {
        if (error.code === "23505") {
          return reply.status(409).send({ message: "Hospital already exists" });
        }

        throw error;
      }
    },
  );

  fastify.delete<HospitalParams>(
    "/hospitals/:id",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const hospitalId = Number(request.params.id);

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply.status(400).send({ message: "Invalid hospital id" });
      }

      try {
        const scope = await getHospitalAccessScope(
          fastify.db,
          Number(request.user.id),
        );

        if (!scope) {
          return reply.status(404).send({ message: "User not found" });
        }

        if (!canAccessHospital(scope, hospitalId)) {
          return reply.status(403).send({
            message: "You cannot delete this hospital",
          });
        }

        if (!scope.canAccessAllHospitals) {
          return reply.status(403).send({
            message: "Only a global admin can delete hospitals",
          });
        }

        const hospital = await deleteHospital(fastify.db, hospitalId);

        if (!hospital) {
          return reply.status(404).send({ message: "Hospital not found" });
        }

        await maybeAutoSyncPrivateSeed(fastify.db);

        return { hospital };
      } catch (error: any) {
        if (error.code === "23503") {
          return reply.status(409).send({
            message: "Hospital cannot be deleted while users or labs exist",
          });
        }

        throw error;
      }
    },
  );
};

export default hospitalRoutes;
