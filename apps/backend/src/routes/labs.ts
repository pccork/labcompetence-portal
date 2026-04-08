import { FastifyPluginAsync } from "fastify";
import {
  Role,
  StaffType,
} from "shared-types";

import {
  canAccessHospital,
  canAccessTrainingUnit,
  getHospitalAccessScope,
  resolveScopedHospitalId,
} from "../services/access-policy-service";
import { findHospitalById } from "../services/hospital-service";
import {
  archiveLab,
  createLab,
  deleteLab,
  findDepartmentById,
  findLabById,
  getLabUsage,
  listLabs,
  restoreLab,
  updateLab,
} from "../services/lab-service";
import { maybeAutoSyncPrivateSeed } from "../services/private-seed-sync-service";
import { assignUserToLab } from "../services/user-lab-service";
import { findUserById } from "../services/user-service";

interface CreateLabBody {
  Body: {
    departmentId?: number | null;
    departmentName?: string;
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

interface LabQuery {
  Querystring: {
    includeArchived?: string;
  };
}

function canCreateLabsForOwnScope(input: {
  role: Role;
  staffType: string;
  isGlobalAdmin: boolean;
}) {
  if (input.role === Role.ADMIN) {
    return true;
  }

  return (
    input.staffType === StaffType.TRAINING_COORDINATOR ||
    input.staffType === StaffType.SENIOR_MEDICAL_SCIENTIST
  );
}

const labRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<LabQuery>(
    "/labs",
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

      const labs = await listLabs(
        fastify.db,
        resolveScopedHospitalId(scope),
        scope.trainingUnitIds,
        includeArchived,
      );

      return { labs };
    },
  );

  fastify.post<CreateLabBody>(
    "/labs",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([Role.ADMIN, Role.TRAINER, Role.STAFF]),
      ],
    },
    async (request, reply) => {
      const hospitalId = Number(request.body?.hospitalId);
      const departmentId =
        request.body?.departmentId === null ||
        request.body?.departmentId === undefined
          ? null
          : Number(request.body.departmentId);
      const departmentName = request.body?.departmentName?.trim() || null;
      const name = request.body?.name?.trim();
      const isPoc = request.body?.isPoc ?? false;

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply
          .status(400)
          .send({ message: "Valid hospitalId is required" });
      }

      if (!name) {
        return reply
          .status(400)
          .send({ message: "Training unit name is required" });
      }

      if (
        departmentId !== null &&
        (!Number.isInteger(departmentId) || departmentId <= 0)
      ) {
        return reply
          .status(400)
          .send({ message: "Valid departmentId is required" });
      }

      const hospital = await findHospitalById(fastify.db, hospitalId);

      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );
      const currentUser = await findUserById(fastify.db, Number(request.user.id));

      if (!scope || !currentUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (
        !canCreateLabsForOwnScope({
          role: request.user.role,
          staffType: currentUser.staff_type,
          isGlobalAdmin: currentUser.is_global_admin,
        })
      ) {
        return reply.status(403).send({ message: "Forbidden" });
      }

      if (!canAccessHospital(scope, hospitalId)) {
        return reply.status(403).send({
          message: "You cannot create labs for this hospital",
        });
      }

      if (!currentUser.is_global_admin) {
        const selectedDepartment =
          departmentId !== null
            ? await findDepartmentById(fastify.db, departmentId)
            : null;

        if (
          !selectedDepartment ||
          selectedDepartment.hospital_id !== hospitalId
        ) {
          return reply.status(403).send({
            message: "Select an existing department for this hospital",
          });
        }

      }

      try {
        const lab = await createLab(
          fastify.db,
          hospitalId,
          name,
          isPoc,
          departmentId,
          departmentName,
        );

        if (!lab) {
          return reply.status(500).send({
            message: "Unable to create training unit",
          });
        }

        await assignUserToLab(
          fastify.db,
          Number(request.user.id),
          lab.id,
        );

        await maybeAutoSyncPrivateSeed(fastify.db);

        return reply.status(201).send({ lab });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply
            .status(409)
            .send({ message: "Training unit already exists" });
        }

        throw error;
      }
    },
  );

  fastify.put<LabParams & CreateLabBody>(
    "/labs/:id",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const labId = Number(request.params.id);
      const hospitalId = Number(request.body?.hospitalId);
      const departmentId =
        request.body?.departmentId === null ||
        request.body?.departmentId === undefined
          ? null
          : Number(request.body.departmentId);
      const departmentName = request.body?.departmentName?.trim() || null;
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
        return reply
          .status(400)
          .send({ message: "Training unit name is required" });
      }

      if (
        departmentId !== null &&
        (!Number.isInteger(departmentId) || departmentId <= 0)
      ) {
        return reply
          .status(400)
          .send({ message: "Valid departmentId is required" });
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

      const existingLab = await findLabById(fastify.db, labId);

      if (!existingLab) {
        return reply.status(404).send({ message: "Training unit not found" });
      }

      if (
        !canAccessTrainingUnit(
          scope,
          existingLab.id,
          existingLab.hospital_id,
          existingLab.is_poc,
        ) ||
        !canAccessHospital(scope, hospitalId)
      ) {
        return reply.status(403).send({
          message: "You cannot update labs across this hospital boundary",
        });
      }

      if (!scope.canAccessAllHospitals) {
        return reply.status(403).send({
          message: "Only a global admin can update sections",
        });
      }

      try {
        const lab = await updateLab(
          fastify.db,
          labId,
          hospitalId,
          name,
          isPoc,
          departmentId,
          departmentName,
        );

        if (!lab) {
          return reply.status(404).send({ message: "Training unit not found" });
        }

        await maybeAutoSyncPrivateSeed(fastify.db);

        return { lab };
      } catch (error: any) {
        if (error.code === "23505") {
          return reply
            .status(409)
            .send({ message: "Training unit already exists" });
        }

        throw error;
      }
    },
  );

  fastify.delete<LabParams>(
    "/labs/:id",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const labId = Number(request.params.id);

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      try {
        const scope = await getHospitalAccessScope(
          fastify.db,
          Number(request.user.id),
        );

        if (!scope) {
          return reply.status(404).send({ message: "User not found" });
        }

        const existingLab = await findLabById(fastify.db, labId);

        if (!existingLab) {
          return reply.status(404).send({ message: "Training unit not found" });
        }

        if (
          !canAccessTrainingUnit(
            scope,
            existingLab.id,
            existingLab.hospital_id,
            existingLab.is_poc,
          )
        ) {
          return reply.status(403).send({
            message: "You cannot delete labs from this hospital",
          });
        }

        const currentUser = await findUserById(fastify.db, Number(request.user.id));

        if (
          !currentUser ||
          !canCreateLabsForOwnScope({
            role: request.user.role,
            staffType: currentUser.staff_type,
            isGlobalAdmin: currentUser.is_global_admin,
          })
        ) {
          return reply.status(403).send({
            message: "You cannot delete sections in this scope",
          });
        }

        const usage = await getLabUsage(fastify.db, labId);

        if (
          (usage?.template_count ?? 0) > 0 ||
          (usage?.assignment_count ?? 0) > 0 ||
          (usage?.record_count ?? 0) > 0 ||
          (usage?.poc_link_count ?? 0) > 0 ||
          (usage?.poc_request_count ?? 0) > 0
        ) {
          return reply.status(409).send({
            message:
              "This section cannot be deleted because linked templates, records, assignments, or other related data already exist. Archive the linked templates first, then archive this section instead of deleting it.",
          });
        }

        const lab = await deleteLab(fastify.db, labId);

        if (!lab) {
          return reply.status(404).send({ message: "Training unit not found" });
        }

        await maybeAutoSyncPrivateSeed(fastify.db);

        return { lab };
      } catch (error: any) {
        if (error.code === "23503") {
          return reply.status(409).send({
            message: "Lab cannot be deleted while related records exist",
          });
        }

        throw error;
      }
    },
  );

  fastify.patch<LabParams>(
    "/labs/:id/archive",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const labId = Number(request.params.id);

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );
      const currentUser = await findUserById(fastify.db, Number(request.user.id));

      if (!scope || !currentUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      const existingLab = await findLabById(fastify.db, labId);

      if (!existingLab) {
        return reply.status(404).send({ message: "Training unit not found" });
      }

      if (
        !canAccessTrainingUnit(
          scope,
          existingLab.id,
          existingLab.hospital_id,
          existingLab.is_poc,
        ) ||
        !canCreateLabsForOwnScope({
          role: request.user.role,
          staffType: currentUser.staff_type,
          isGlobalAdmin: currentUser.is_global_admin,
        })
      ) {
        return reply.status(403).send({
          message: "You cannot archive sections in this scope",
        });
      }

      const usage = await getLabUsage(fastify.db, labId);

      if (
        (usage?.active_template_count ?? 0) > 0 ||
        (usage?.active_record_count ?? 0) > 0
      ) {
        return reply.status(409).send({
          message:
            "This section cannot be archived while active templates or active training records still exist. Archive each template in this section first. Linked training records will be archived with their template.",
        });
      }

      const archived = await archiveLab(fastify.db, labId);

      if (!archived) {
        return reply.status(404).send({ message: "Training unit not found" });
      }

      await maybeAutoSyncPrivateSeed(fastify.db);

      return { archived: true };
    },
  );

  fastify.patch<LabParams>(
    "/labs/:id/restore",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const labId = Number(request.params.id);

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Invalid lab id" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );
      const currentUser = await findUserById(fastify.db, Number(request.user.id));

      if (!scope || !currentUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      const existingLab = await findLabById(fastify.db, labId);

      if (!existingLab) {
        return reply.status(404).send({ message: "Training unit not found" });
      }

      if (
        !canAccessTrainingUnit(
          scope,
          existingLab.id,
          existingLab.hospital_id,
          existingLab.is_poc,
        ) ||
        !canCreateLabsForOwnScope({
          role: request.user.role,
          staffType: currentUser.staff_type,
          isGlobalAdmin: currentUser.is_global_admin,
        })
      ) {
        return reply.status(403).send({
          message: "You cannot restore sections in this scope",
        });
      }

      const restored = await restoreLab(fastify.db, labId);

      if (!restored) {
        return reply.status(404).send({ message: "Training unit not found" });
      }

      await maybeAutoSyncPrivateSeed(fastify.db);

      return { restored: true };
    },
  );
};

export default labRoutes;
