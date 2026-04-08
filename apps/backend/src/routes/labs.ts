import { FastifyPluginAsync } from "fastify";
import {
  DEFAULT_CORE_DEPARTMENTS,
  POINT_OF_CARE_DEPARTMENT,
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
  createLab,
  deleteLab,
  findDepartmentById,
  findLabById,
  listLabs,
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

function isAllowedLocalDepartmentName(
  departmentName: string,
  isPoc: boolean,
) {
  if (isPoc) {
    return departmentName === POINT_OF_CARE_DEPARTMENT;
  }

  return DEFAULT_CORE_DEPARTMENTS.includes(
    departmentName as (typeof DEFAULT_CORE_DEPARTMENTS)[number],
  );
}

const labRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/labs",
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

      const labs = await listLabs(
        fastify.db,
        resolveScopedHospitalId(scope),
        scope.trainingUnitIds,
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
        const effectiveDepartmentName =
          selectedDepartment?.name ?? departmentName ?? null;
        const effectiveIsPoc = selectedDepartment?.is_poc ?? isPoc;

        if (
          selectedDepartment &&
          selectedDepartment.hospital_id !== hospitalId
        ) {
          return reply.status(403).send({
            message: "Department does not belong to the selected hospital",
          });
        }

        if (!effectiveDepartmentName) {
          return reply.status(400).send({
            message: "Department selection is required",
          });
        }

        if (
          !isAllowedLocalDepartmentName(
            effectiveDepartmentName,
            effectiveIsPoc,
          )
        ) {
          return reply.status(403).send({
            message:
              "Local setup can only create sections in approved departments",
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

        if (!scope.canAccessAllHospitals) {
          return reply.status(403).send({
            message: "Only a global admin can delete sections",
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
};

export default labRoutes;
