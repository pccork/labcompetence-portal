import { FastifyPluginAsync } from "fastify";
import {
  AssignmentStatus,
  Role,
} from "shared-types";

import { findUserById } from "../services/user-service";
import {
  createTrainingRecord,
  findTrainingRecordById,
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
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async () => {
      const records = await listTrainingRecords(fastify.db);

      return { records };
    }
  );

  fastify.get<TrainingRecordParams>(
    "/training-records/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
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

      return { record };
    }
  );

  fastify.post<CreateTrainingRecordBody>(
    "/training-records",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const traineeId = Number(request.body.traineeId);
      const templateVersionId = Number(request.body.templateVersionId);
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

      const trainee = await findUserById(fastify.db, traineeId);

      if (!trainee) {
        return reply.status(404).send({ message: "Trainee not found" });
      }

      try {
        const record = await createTrainingRecord(
          fastify.db,
          status
            ? {
                traineeId,
                templateVersionId,
                expiresAt,
                status: status as AssignmentStatus,
              }
            : {
                traineeId,
                templateVersionId,
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
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const days = Number(request.query.days ?? "30");

      if (!Number.isInteger(days) || days <= 0) {
        return reply.status(400).send({ message: "Valid days query is required" });
      }

      const records = await listTrainingRecordsExpiringWithinDays(
        fastify.db,
        days
      );

      return { records };
    }
  );
};

export default trainingRecordRoutes;
