import { FastifyPluginAsync } from "fastify";
import { Role } from "shared-types";

import {
  canAccessHospital,
  canAccessTrainingUnit,
  getHospitalAccessScope,
  resolveScopedHospitalId,
} from "../services/access-policy-service";
import { findUserById } from "../services/user-service";
import {
  createTrainingAssignment,
  findTemplateAssignmentScopeByTemplateId,
  findTrainingAssignmentById,
  listTrainingAssignments,
  listTrainingAssignmentsDueWithinDays,
  updateTrainingAssignment,
} from "../services/training-assignment-service";
import { maybeAutoSyncPrivateSeed } from "../services/private-seed-sync-service";
import { sendNonPocTrainingReminders } from "../services/training-reminder-service";

interface CreateTrainingAssignmentBody {
  Body: {
    userId?: number;
    templateId?: number;
    renewalIntervalMonths?: number;
    nextDueAt?: string;
  };
}

interface TrainingAssignmentParams {
  Params: {
    id: string;
  };
}

interface UpdateTrainingAssignmentBody {
  Body: {
    renewalIntervalMonths?: number;
    nextDueAt?: string;
    isActive?: boolean;
  };
}

interface DueQuery {
  Querystring: {
    days?: string;
  };
}

interface SendReminderBody {
  Body: {
    dryRun?: boolean;
    dueWithinDays?: number;
  };
}

const trainingAssignmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/training-assignments",
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

      const assignments = await listTrainingAssignments(
        fastify.db,
        resolveScopedHospitalId(scope),
        scope.canAccessCrossHospitalPoc,
        scope.trainingUnitIds,
      );

      return {
        assignments:
          request.user.role === Role.STAFF
            ? assignments.filter(
                (assignment) => assignment.user_id === Number(request.user.id),
              )
            : assignments,
      };
    },
  );

  fastify.get<DueQuery>(
    "/training-assignments/due",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([Role.ADMIN, Role.TRAINER, Role.STAFF]),
      ],
    },
    async (request, reply) => {
      const days = Number(request.query.days ?? "30");

      if (!Number.isInteger(days) || days <= 0) {
        return reply
          .status(400)
          .send({ message: "Valid days query is required" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const assignments = await listTrainingAssignmentsDueWithinDays(
        fastify.db,
        days,
        resolveScopedHospitalId(scope),
        scope.canAccessCrossHospitalPoc,
        scope.trainingUnitIds,
      );

      return {
        assignments:
          request.user.role === Role.STAFF
            ? assignments.filter(
                (assignment) => assignment.user_id === Number(request.user.id),
              )
            : assignments,
      };
    },
  );

  fastify.post<CreateTrainingAssignmentBody>(
    "/training-assignments",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const userId = Number(request.body.userId);
      const templateId = Number(request.body.templateId);
      const renewalIntervalMonths = Number(
        request.body.renewalIntervalMonths ?? 12,
      );
      const nextDueAt = request.body.nextDueAt;

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Valid userId is required" });
      }

      if (!Number.isInteger(templateId) || templateId <= 0) {
        return reply
          .status(400)
          .send({ message: "Valid templateId is required" });
      }

      if (
        !Number.isInteger(renewalIntervalMonths) ||
        renewalIntervalMonths <= 0
      ) {
        return reply.status(400).send({
          message: "Valid renewalIntervalMonths is required",
        });
      }

      if (!nextDueAt || Number.isNaN(Date.parse(nextDueAt))) {
        return reply
          .status(400)
          .send({ message: "Valid nextDueAt timestamp is required" });
      }

      const trainee = await findUserById(fastify.db, userId);

      if (!trainee) {
        return reply.status(404).send({ message: "User not found" });
      }

      const templateScope = await findTemplateAssignmentScopeByTemplateId(
        fastify.db,
        templateId,
      );

      if (!templateScope) {
        return reply.status(404).send({ message: "Template not found" });
      }

      if (trainee.staff_type !== templateScope.target_staff_type) {
        return reply.status(400).send({
          message:
            "Template target staff type does not match this user's staffType",
        });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (
        !canAccessHospital(scope, trainee.hospital_id) ||
        !canAccessTrainingUnit(
          scope,
          templateScope.lab_id,
          templateScope.hospital_id,
          templateScope.is_poc,
        )
      ) {
        return reply.status(403).send({
          message: "You cannot assign training across this hospital boundary",
        });
      }

      try {
        const assignment = await createTrainingAssignment(fastify.db, {
          userId,
          templateId,
          labId: templateScope.lab_id,
          assignedBy: Number(request.user.id),
          renewalIntervalMonths,
          nextDueAt,
        });

        await maybeAutoSyncPrivateSeed(fastify.db);

        return reply.status(201).send({ assignment });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply.status(409).send({
            message: "This user is already assigned to this template",
          });
        }

        throw error;
      }
    },
  );

  fastify.post<SendReminderBody>(
    "/training-assignments/reminders/send",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const dueWithinDays = Number(request.body.dueWithinDays ?? 30);
      const emailConfigured = fastify.emailService.isConfigured();
      // TODO: Remove this forced preview safeguard once Render email delivery
      // is configured for the deployed environment.
      const dryRun = request.body.dryRun === true || !emailConfigured;

      if (!Number.isInteger(dueWithinDays) || dueWithinDays <= 0) {
        return reply.status(400).send({
          message: "Valid dueWithinDays is required",
        });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const result = await sendNonPocTrainingReminders(
        fastify.db,
        fastify.emailService,
        {
          dueWithinDays,
          dryRun,
          ...(resolveScopedHospitalId(scope) !== undefined
            ? { hospitalId: resolveScopedHospitalId(scope) }
            : {}),
          ...(!scope.canAccessAllHospitals
            ? { trainingUnitIds: scope.trainingUnitIds }
            : {}),
        },
      );

      return {
        emailDelivery: emailConfigured
          ? {
              configured: true,
              mode: "active",
            }
          : {
              configured: false,
              mode: "preview_only",
              message:
                "Email provider disabled. Reminder run executed as preview only.",
            },
        reminders: result,
      };
    },
  );

  fastify.patch<TrainingAssignmentParams & UpdateTrainingAssignmentBody>(
    "/training-assignments/:id",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(Role.ADMIN)],
    },
    async (request, reply) => {
      const assignmentId = Number(request.params.id);
      const renewalIntervalMonths = Number(request.body.renewalIntervalMonths);
      const nextDueAt = request.body.nextDueAt;
      const isActive = request.body.isActive;

      if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
        return reply
          .status(400)
          .send({ message: "Invalid training assignment id" });
      }

      if (
        !Number.isInteger(renewalIntervalMonths) ||
        renewalIntervalMonths <= 0
      ) {
        return reply.status(400).send({
          message: "Valid renewalIntervalMonths is required",
        });
      }

      if (!nextDueAt || Number.isNaN(Date.parse(nextDueAt))) {
        return reply
          .status(400)
          .send({ message: "Valid nextDueAt timestamp is required" });
      }

      if (typeof isActive !== "boolean") {
        return reply
          .status(400)
          .send({ message: "isActive must be a boolean" });
      }

      const existingAssignment = await findTrainingAssignmentById(
        fastify.db,
        assignmentId,
      );

      if (!existingAssignment) {
        return reply
          .status(404)
          .send({ message: "Training assignment not found" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id),
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (
        !canAccessHospital(scope, existingAssignment.trainee_hospital_id) ||
        !canAccessTrainingUnit(
          scope,
          existingAssignment.lab_id,
          existingAssignment.lab_hospital_id,
          existingAssignment.lab_is_poc,
        )
      ) {
        return reply.status(403).send({
          message:
            "You cannot update this training assignment across this hospital boundary",
        });
      }

      const assignment = await updateTrainingAssignment(
        fastify.db,
        assignmentId,
        renewalIntervalMonths,
        nextDueAt,
        isActive,
      );

      if (!assignment) {
        return reply
          .status(404)
          .send({ message: "Training assignment not found" });
      }

      await maybeAutoSyncPrivateSeed(fastify.db);

      return { assignment };
    },
  );
};

export default trainingAssignmentRoutes;
