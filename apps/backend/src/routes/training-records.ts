import { FastifyPluginAsync } from "fastify";
import {
  AssignmentStatus,
  Role,
} from "shared-types";

import {
  canAccessHospital,
  canAccessTrainingUnit,
  getHospitalAccessScope,
  resolveScopedHospitalId,
} from "../services/access-policy-service";
import { findTrainingAssignmentById } from "../services/training-assignment-service";
import { findUserById } from "../services/user-service";
import {
  createTrainingRecord,
  findTrainingRecordById,
  findTemplateVersionHospitalScopeById,
  listTrainingRecords,
  listTrainingRecordsExpiringWithinDays,
} from "../services/training-record-service";

interface TrainingRecordParams {
  Params: {
    id: string;
  };
}

interface CreateTrainingRecordBody {
  Body: {
    traineeId?: number;
    templateVersionId?: number;
    assignedTrainerId?: number | null;
    trainingAssignmentId?: number | null;
    scheduledAt?: string | null;
    completedAt?: string | null;
    traineeSignedAt?: string | null;
    assessmentPayloadJson?: Record<string, unknown>;
    specimens?: Array<{
      specimenLabel?: string;
      specimenType?: string | null;
      analyserReference?: string | null;
      processedAt?: string | null;
      resultSummary?: string | null;
    }>;
    expiresAt?: string;
    status?: string;
  };
}

interface ReminderQuery {
  Querystring: {
    days?: string;
  };
}

const allowedStatuses = new Set<string>(Object.values(AssignmentStatus));

const trainingRecordRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/training-records",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([
          Role.ADMIN,
          Role.TRAINER,
          Role.STAFF,
        ]),
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

      const records = await listTrainingRecords(
        fastify.db,
        resolveScopedHospitalId(scope),
        scope.canAccessCrossHospitalPoc,
        scope.trainingUnitIds
      );

      return {
        records:
          request.user.role === Role.STAFF
            ? records.filter(
                (record) => record.trainee_id === Number(request.user.id)
              )
            : records,
      };
    }
  );

  fastify.get<TrainingRecordParams>(
    "/training-records/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([
          Role.ADMIN,
          Role.TRAINER,
          Role.STAFF,
        ]),
      ],
    },
    async (request, reply) => {
      const id = Number(request.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return reply.status(400).send({ message: "Invalid training record id" });
      }

      const record = await findTrainingRecordById(fastify.db, id);

      if (!record) {
        return reply.status(404).send({ message: "Training record not found" });
      }

      if (
        request.user.role === Role.STAFF &&
        record.trainee_id !== Number(request.user.id)
      ) {
        return reply.status(403).send({
          message: "You can only access your own training records",
        });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (
        !canAccessHospital(
          scope,
          record.lab_hospital_id,
          record.lab_is_poc
        ) ||
        !canAccessTrainingUnit(
          scope,
          record.lab_id,
          record.lab_hospital_id,
          record.lab_is_poc
        )
      ) {
        return reply.status(403).send({
          message: "You cannot access this training record's hospital",
        });
      }

      return { record };
    }
  );

  fastify.post<CreateTrainingRecordBody>(
    "/training-records",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([
          Role.ADMIN,
          Role.TRAINER,
          Role.STAFF,
        ]),
      ],
    },
    async (request, reply) => {
      const traineeId = Number(request.body.traineeId);
      const templateVersionId = Number(request.body.templateVersionId);
      const assignedTrainerId =
        request.body.assignedTrainerId === null ||
        request.body.assignedTrainerId === undefined
          ? null
          : Number(request.body.assignedTrainerId);
      const trainingAssignmentId =
        request.body.trainingAssignmentId === null ||
        request.body.trainingAssignmentId === undefined
          ? null
          : Number(request.body.trainingAssignmentId);
      const scheduledAt = request.body.scheduledAt ?? null;
      const completedAt = request.body.completedAt ?? null;
      const traineeSignedAt = request.body.traineeSignedAt ?? null;
      const assessmentPayloadJson =
        request.body.assessmentPayloadJson ?? {};
      const specimens = request.body.specimens ?? [];
      const expiresAt = request.body.expiresAt;
      const status = request.body.status?.trim().toLowerCase();

      if (!Number.isInteger(traineeId) || traineeId <= 0) {
        return reply.status(400).send({ message: "Valid traineeId is required" });
      }

      if (!Number.isInteger(templateVersionId) || templateVersionId <= 0) {
        return reply.status(400).send({
          message: "Valid templateVersionId is required",
        });
      }

      if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) {
        return reply.status(400).send({
          message: "Valid expiresAt timestamp is required",
        });
      }

      if (status && !allowedStatuses.has(status)) {
        return reply.status(400).send({ message: "Valid status is required" });
      }

      if (
        assignedTrainerId !== null &&
        (!Number.isInteger(assignedTrainerId) || assignedTrainerId <= 0)
      ) {
        return reply
          .status(400)
          .send({ message: "Valid assignedTrainerId is required" });
      }

      if (
        trainingAssignmentId !== null &&
        (!Number.isInteger(trainingAssignmentId) ||
          trainingAssignmentId <= 0)
      ) {
        return reply
          .status(400)
          .send({ message: "Valid trainingAssignmentId is required" });
      }

      if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) {
        return reply
          .status(400)
          .send({ message: "Valid scheduledAt timestamp is required" });
      }

      if (completedAt && Number.isNaN(Date.parse(completedAt))) {
        return reply
          .status(400)
          .send({ message: "Valid completedAt timestamp is required" });
      }

      if (traineeSignedAt && Number.isNaN(Date.parse(traineeSignedAt))) {
        return reply
          .status(400)
          .send({ message: "Valid traineeSignedAt timestamp is required" });
      }

      for (const specimen of specimens) {
        if (!specimen.specimenLabel?.trim()) {
          return reply
            .status(400)
            .send({ message: "Each specimen needs a specimenLabel" });
        }

        if (
          specimen.processedAt &&
          Number.isNaN(Date.parse(specimen.processedAt))
        ) {
          return reply
            .status(400)
            .send({ message: "Valid specimen processedAt timestamps are required" });
        }
      }

      const trainee = await findUserById(fastify.db, traineeId);

      if (!trainee) {
        return reply.status(404).send({ message: "Trainee not found" });
      }

      const templateVersionScope =
        await findTemplateVersionHospitalScopeById(
          fastify.db,
          templateVersionId
        );

      if (!templateVersionScope) {
        return reply
          .status(404)
          .send({ message: "Template version not found" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (assignedTrainerId !== null) {
        const trainer = await findUserById(
          fastify.db,
          assignedTrainerId
        );

        if (!trainer) {
          return reply.status(404).send({ message: "Trainer not found" });
        }

        if (!canAccessHospital(scope, trainer.hospital_id)) {
          return reply.status(403).send({
            message:
              "You cannot assign a trainer across this hospital boundary",
          });
        }
      }

      if (trainingAssignmentId !== null) {
        const assignment = await findTrainingAssignmentById(
          fastify.db,
          trainingAssignmentId
        );

        if (!assignment) {
          return reply
            .status(404)
            .send({ message: "Training assignment not found" });
        }

        if (
          assignment.user_id !== traineeId ||
          assignment.template_id !== templateVersionScope.template_id
        ) {
          return reply.status(400).send({
            message:
              "Training assignment must belong to the same trainee and template",
          });
        }
      }

      if (
        !canAccessHospital(scope, trainee.hospital_id) ||
        !canAccessTrainingUnit(
          scope,
          templateVersionScope.lab_id,
          templateVersionScope.hospital_id,
          templateVersionScope.is_poc
        )
      ) {
        return reply.status(403).send({
          message: "You cannot create training records across this hospital boundary",
        });
      }

      try {
        const record = await createTrainingRecord(
          fastify.db,
          status
            ? {
              traineeId,
              templateVersionId,
              assignedTrainerId,
              trainingAssignmentId,
              scheduledAt,
              completedAt,
              traineeSignedAt,
              assessmentPayloadJson,
              specimens: specimens.map((specimen) => ({
                specimenLabel: specimen.specimenLabel!.trim(),
                specimenType: specimen.specimenType?.trim() || null,
                analyserReference:
                  specimen.analyserReference?.trim() || null,
                processedAt: specimen.processedAt || null,
                resultSummary: specimen.resultSummary?.trim() || null,
              })),
              expiresAt,
              status: status as AssignmentStatus,
            }
            : {
                traineeId,
                templateVersionId,
                assignedTrainerId,
                trainingAssignmentId,
                scheduledAt,
                completedAt,
                traineeSignedAt,
                assessmentPayloadJson,
                specimens: specimens.map((specimen) => ({
                  specimenLabel: specimen.specimenLabel!.trim(),
                  specimenType: specimen.specimenType?.trim() || null,
                  analyserReference:
                    specimen.analyserReference?.trim() || null,
                  processedAt: specimen.processedAt || null,
                  resultSummary: specimen.resultSummary?.trim() || null,
                })),
                expiresAt,
              }
        );

        return reply.status(201).send({ record });
      } catch (error: any) {
        if (error.code === "23503") {
          return reply.status(404).send({
            message: "Template version not found",
          });
        }

        throw error;
      }
    }
  );

  fastify.get<ReminderQuery>(
    "/training-records/reminders/upcoming",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([
          Role.ADMIN,
          Role.TRAINER,
          Role.STAFF,
        ]),
      ],
    },
    async (request, reply) => {
      const days = Number(request.query.days ?? "30");

      if (!Number.isInteger(days) || days <= 0) {
        return reply.status(400).send({ message: "Valid days query is required" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const records = await listTrainingRecordsExpiringWithinDays(
        fastify.db,
        days,
        resolveScopedHospitalId(scope),
        scope.canAccessCrossHospitalPoc,
        scope.trainingUnitIds
      );

      return {
        records:
          request.user.role === Role.STAFF
            ? records.filter(
                (record) => record.trainee_id === Number(request.user.id)
              )
            : records,
      };
    }
  );
};

export default trainingRecordRoutes;
