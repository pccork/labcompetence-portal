import { FastifyPluginAsync } from "fastify";
import { Role } from "shared-types";

import {
  canAccessHospital,
  getHospitalAccessScope,
  resolveScopedHospitalId,
} from "../services/access-policy-service";
import { findHospitalById } from "../services/hospital-service";
import {
  archiveDepartment,
  createDepartment,
  deleteDepartment,
  findDepartmentById,
  getDepartmentUsage,
  listDepartments,
  restoreDepartment,
} from "../services/lab-service";
import { maybeAutoSyncPrivateSeed } from "../services/private-seed-sync-service";

interface CreateDepartmentBody {
  Body: {
    hospitalId?: number;
    name?: string;
    isPoc?: boolean;
  };
}

interface DepartmentParams {
  Params: {
    id: string;
  };
}

interface DepartmentQuery {
  Querystring: {
    includeArchived?: string;
  };
}

const departmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<DepartmentQuery>(
    "/departments",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([Role.ADMIN, Role.TRAINER, Role.STAFF]),
      ],
    },
    async (request, reply) => {
      const includeArchived = request.query?.includeArchived === "true";
      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const departments = await listDepartments(
        fastify.db,
        resolveScopedHospitalId(scope),
        includeArchived,
      );

      return { departments };
    },
  );

  fastify.post<CreateDepartmentBody>(
    "/departments",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const hospitalId = Number(request.body?.hospitalId);
      const name = request.body?.name?.trim();
      const isPoc = request.body?.isPoc ?? false;

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply.status(400).send({ message: "Valid hospitalId is required" });
      }

      if (!name) {
        return reply.status(400).send({ message: "Department name is required" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!canAccessHospital(scope, hospitalId)) {
        return reply.status(403).send({
          message: "You cannot create departments for this hospital",
        });
      }

      if (!scope.canAccessAllHospitals) {
        return reply.status(403).send({
          message: "Only a global admin can create new departments",
        });
      }

      const hospital = await findHospitalById(fastify.db, hospitalId);

      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }

      try {
        const department = await createDepartment(
          fastify.db,
          hospitalId,
          name,
          isPoc,
        );

        await maybeAutoSyncPrivateSeed(fastify.db);

        return reply.status(201).send({ department });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply.status(409).send({ message: "Department already exists" });
        }

        throw error;
      }
    },
  );

  fastify.patch<DepartmentParams>(
    "/departments/:id/archive",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const departmentId = Number(request.params.id);

      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return reply.status(400).send({ message: "Invalid department id" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!scope.canAccessAllHospitals) {
        return reply.status(403).send({
          message: "Only a global admin can archive departments",
        });
      }

      const department = await findDepartmentById(fastify.db, departmentId);

      if (!department) {
        return reply.status(404).send({ message: "Department not found" });
      }

      const archived = await archiveDepartment(fastify.db, departmentId);

      if (!archived) {
        return reply.status(404).send({ message: "Department not found" });
      }

      await maybeAutoSyncPrivateSeed(fastify.db);

      return { archived: true };
    },
  );

  fastify.patch<DepartmentParams>(
    "/departments/:id/restore",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const departmentId = Number(request.params.id);

      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return reply.status(400).send({ message: "Invalid department id" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!scope.canAccessAllHospitals) {
        return reply.status(403).send({
          message: "Only a global admin can restore departments",
        });
      }

      const department = await findDepartmentById(fastify.db, departmentId);

      if (!department) {
        return reply.status(404).send({ message: "Department not found" });
      }

      const restored = await restoreDepartment(fastify.db, departmentId);

      if (!restored) {
        return reply.status(404).send({ message: "Department not found" });
      }

      await maybeAutoSyncPrivateSeed(fastify.db);

      return { restored: true };
    },
  );

  fastify.delete<DepartmentParams>(
    "/departments/:id",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const departmentId = Number(request.params.id);

      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return reply.status(400).send({ message: "Invalid department id" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!scope.canAccessAllHospitals) {
        return reply.status(403).send({
          message: "Only a global admin can delete departments",
        });
      }

      const department = await findDepartmentById(fastify.db, departmentId);

      if (!department) {
        return reply.status(404).send({ message: "Department not found" });
      }

      const usage = await getDepartmentUsage(fastify.db, departmentId);

      if ((usage?.section_count ?? 0) > 0) {
        return reply.status(409).send({
          message:
            "This department cannot be deleted because sections or linked records already exist. Archive the department instead.",
        });
      }

      const deleted = await deleteDepartment(fastify.db, departmentId);

      if (!deleted) {
        return reply.status(404).send({ message: "Department not found" });
      }

      await maybeAutoSyncPrivateSeed(fastify.db);

      return { deleted: true };
    },
  );
};

export default departmentRoutes;
