import { FastifyPluginAsync } from "fastify";
import {
  PocTrainingRequestStatus,
  Role,
  StaffType,
} from "shared-types";

import { findHospitalById } from "../services/hospital-service";
import { listHospitals } from "../services/hospital-service";
import { findLabById } from "../services/lab-service";
import {
  canAccessHospital,
  canAccessTrainingUnit,
  getHospitalAccessScope,
  resolveScopedHospitalId,
} from "../services/access-policy-service";
import {
  createPocRegistrationLink,
  findPocRegistrationLinkByCode,
  PocTrainingRequest,
  findPocTrainingRequestById,
  listPocTrainingRequestRecipients,
  listPocRegistrationLinks,
  listPocTrainingRequests,
  registerTraineeFromPocLink,
  replyToPocTrainingRequest,
  setPocRegistrationLinkStatus,
} from "../services/poc-registration-service";
import { withEmailDispatchGuard } from "../services/email-dispatch-service";

interface RegistrationLinkParams {
  Params: {
    code: string;
  };
}

interface CreateRegistrationLinkBody {
  Body: {
    labId?: number;
    defaultTrainingLocation?: string;
    defaultTrainingTimeDetails?: string;
  };
}

interface UpdateRegistrationLinkBody {
  Body: {
    isActive?: boolean;
  };
}

interface TrainingRequestParams {
  Params: {
    id: string;
  };
}

interface TrainerReplyBody {
  Body: {
    trainerReplyStatus?: string;
    trainingLocation?: string;
    trainingTimeDetails?: string;
    trainerMessage?: string;
  };
}

interface PocSelfRegisterRoute {
  Params: {
    code: string;
  };
  Body: {
    hospitalId?: number;
    name?: string;
    email?: string;
    password?: string;
    staffType?: string;
  };
}

const allowedPocSelfRegistrationStaffTypes = new Set<string>([
  StaffType.POCT_MEDICAL_NURSING,
  StaffType.POCT_SCIENTIST,
]);

function buildPocReplyDedupeKey(request: PocTrainingRequest) {
  return [
    "poc_training_reply",
    request.id,
    request.trainer_reply_status,
    request.training_location?.trim() || "",
    request.training_time_details?.trim() || "",
    request.trainer_message?.trim() || "",
  ].join(":");
}

function buildPocTrainerNotificationDedupeKey(
  request: PocTrainingRequest,
  trainerEmail: string,
) {
  return [
    "poc_training_request_trainer",
    request.id,
    trainerEmail.trim().toLowerCase(),
  ].join(":");
}

const pocRegistrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/poc/hospitals", async () => {
    const hospitals = await listHospitals(fastify.db);
    return { hospitals };
  });

  fastify.get(
    "/poc/registration-links",
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

      const registrationLinks = await listPocRegistrationLinks(
        fastify.db,
        scope.trainingUnitIds
      );

      return { registrationLinks };
    }
  );

  fastify.post<CreateRegistrationLinkBody>(
    "/poc/registration-links",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const labId = Number(request.body.labId);

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Valid labId is required" });
      }

      const lab = await findLabById(fastify.db, labId);

      if (!lab) {
        return reply.status(404).send({ message: "Lab not found" });
      }

      if (!lab.is_poc) {
        return reply.status(400).send({
          message: "Registration links can only be created for POC labs",
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
        !canAccessTrainingUnit(
          scope,
          lab.id,
          lab.hospital_id,
          lab.is_poc
        )
      ) {
        return reply.status(403).send({
          message: "You cannot create POC registration links for this lab",
        });
      }

      const registrationLink = await createPocRegistrationLink(
        fastify.db,
        labId,
        request.body.defaultTrainingLocation?.trim() || null,
        request.body.defaultTrainingTimeDetails?.trim() || null
      );

      return reply.status(201).send({ registrationLink });
    }
  );

  fastify.patch<RegistrationLinkParams & UpdateRegistrationLinkBody>(
    "/poc/registration-links/:code",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      if (typeof request.body.isActive !== "boolean") {
        return reply
          .status(400)
          .send({ message: "isActive must be true or false" });
      }

      const registrationLink = await findPocRegistrationLinkByCode(
        fastify.db,
        request.params.code
      );

      if (!registrationLink) {
        return reply
          .status(404)
          .send({ message: "POC registration link not found" });
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
          registrationLink.hospital_id,
          registrationLink.lab_is_poc
        ) ||
        !canAccessTrainingUnit(
          scope,
          registrationLink.lab_id,
          registrationLink.hospital_id,
          registrationLink.lab_is_poc
        )
      ) {
        return reply.status(403).send({
          message: "You cannot update this POC registration link",
        });
      }

      const updatedLink = await setPocRegistrationLinkStatus(
        fastify.db,
        request.params.code,
        request.body.isActive
      );

      if (!updatedLink) {
        return reply
          .status(404)
          .send({ message: "POC registration link not found" });
      }

      return { registrationLink: updatedLink };
    }
  );

  fastify.get<RegistrationLinkParams>(
    "/poc/registration-links/:code",
    async (request, reply) => {
      const registrationLink = await findPocRegistrationLinkByCode(
        fastify.db,
        request.params.code
      );

      if (
        !registrationLink ||
        !registrationLink.is_active ||
        !registrationLink.lab_is_poc
      ) {
        return reply
          .status(404)
          .send({ message: "POC registration link not found" });
      }

      return { registrationLink };
    }
  );

  fastify.post<PocSelfRegisterRoute>(
    "/poc/registration-links/:code/register",
    async (request, reply) => {
      const hospitalId = Number(request.body.hospitalId);
      const name = request.body.name?.trim();
      const email = request.body.email?.trim().toLowerCase();
      const password = request.body.password?.trim();
      const staffType = (
        request.body.staffType?.trim().toLowerCase() ||
        StaffType.POCT_MEDICAL_NURSING
      );

      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        return reply
          .status(400)
          .send({ message: "Valid hospitalId is required" });
      }

      if (!name) {
        return reply.status(400).send({ message: "Name is required" });
      }

      if (!email) {
        return reply.status(400).send({ message: "Email is required" });
      }

      if (password && password.length < 8) {
        return reply.status(400).send({
          message:
            "Password must be at least 8 characters long when provided",
        });
      }

      if (!allowedPocSelfRegistrationStaffTypes.has(staffType)) {
        return reply.status(400).send({
          message:
            "staffType must be poct_medical_nursing or poct_scientist",
        });
      }

      const hospital = await findHospitalById(fastify.db, hospitalId);

      if (!hospital) {
        return reply.status(404).send({ message: "Hospital not found" });
      }

      try {
        const registration = await registerTraineeFromPocLink(
          fastify.db,
          {
            registrationCode: request.params.code,
            hospitalId,
            name,
            email,
            staffType: staffType as StaffType,
            ...(password ? { password } : {}),
          }
        );

        if (!registration) {
          return reply
            .status(404)
            .send({ message: "POC registration link not found" });
        }

        const trainerRecipients = await listPocTrainingRequestRecipients(
          fastify.db,
          registration.trainingRequest.id
        );

        void Promise.all(
          trainerRecipients.map((recipient) =>
            withEmailDispatchGuard(fastify.db, {
              dedupeKey: buildPocTrainerNotificationDedupeKey(
                registration.trainingRequest,
                recipient.email,
              ),
              entityId: registration.trainingRequest.id,
              entityType: "poc_training_request",
              notificationType: "poc_training_request_trainer_notification",
              payloadSummary: {
                deviceName: registration.trainingRequest.lab_name,
                traineeEmail: registration.trainingRequest.trainee_email,
                traineeName: registration.trainingRequest.trainee_name,
              },
              recipientEmail: recipient.email,
              send: () =>
                fastify.emailService.sendTrainingRequestTrainerNotificationEmail({
                  trainerName: recipient.name,
                  trainerEmail: recipient.email,
                  traineeName: registration.trainingRequest.trainee_name,
                  traineeEmail: registration.trainingRequest.trainee_email,
                  traineeHospitalName:
                    registration.trainingRequest.trainee_hospital_name,
                  staffType: registration.trainingRequest.trainee_staff_type,
                  deviceName: registration.trainingRequest.lab_name,
                  hospitalName: registration.trainingRequest.lab_hospital_name,
                  location: registration.trainingRequest.training_location,
                  timeDetails:
                    registration.trainingRequest.training_time_details,
                  requestedAt: registration.trainingRequest.requested_at,
                }),
            }).catch((error) => {
              request.log.error(
                {
                  err: error,
                  requestId: registration.trainingRequest.id,
                  recipientEmail: recipient.email,
                },
                "Failed to send POCT trainer notification email",
              );
            }),
          ),
        );

        return reply.status(201).send({ registration });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply.status(409).send({
            message:
              "A matching user or pending POCT request already exists for this email",
          });
        }

        if (error.code === "23503") {
          return reply.status(404).send({ message: "Hospital not found" });
        }

        throw error;
      }
    }
  );

  fastify.get(
    "/poc/training-requests",
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

      const requests = await listPocTrainingRequests(
        fastify.db,
        resolveScopedHospitalId(scope),
        scope.canAccessCrossHospitalPoc,
        scope.trainingUnitIds
      );

      return { requests };
    }
  );

  fastify.patch<TrainingRequestParams & TrainerReplyBody>(
    "/poc/training-requests/:id/reply",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const requestId = Number(request.params.id);
      const trainerReplyStatus =
        request.body.trainerReplyStatus?.trim().toLowerCase();
      const trainingLocation =
        request.body.trainingLocation?.trim() || null;
      const trainingTimeDetails =
        request.body.trainingTimeDetails?.trim() || null;
      const trainerMessage = request.body.trainerMessage?.trim() || null;

      if (!Number.isInteger(requestId) || requestId <= 0) {
        return reply.status(400).send({ message: "Invalid request id" });
      }

      if (
        trainerReplyStatus !== PocTrainingRequestStatus.SCHEDULED &&
        trainerReplyStatus !== PocTrainingRequestStatus.CANCELLED
      ) {
        return reply.status(400).send({
          message:
            "trainerReplyStatus must be scheduled or cancelled",
        });
      }

      const trainingRequest = await findPocTrainingRequestById(
        fastify.db,
        requestId
      );

      if (!trainingRequest) {
        return reply
          .status(404)
          .send({ message: "POC training request not found" });
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
          trainingRequest.lab_hospital_id,
          trainingRequest.lab_is_poc
        ) ||
        !canAccessTrainingUnit(
          scope,
          trainingRequest.lab_id,
          trainingRequest.lab_hospital_id,
          trainingRequest.lab_is_poc
        )
      ) {
        return reply.status(403).send({
          message: "You cannot reply to this POC training request",
        });
      }

      const updatedRequest = await replyToPocTrainingRequest(
        fastify.db,
        {
          requestId,
          responderId: Number(request.user.id),
          status: trainerReplyStatus,
          trainingLocation:
            trainingLocation ?? trainingRequest.training_location,
          trainingTimeDetails:
            trainingTimeDetails ??
            trainingRequest.training_time_details,
          trainerMessage,
        }
      );

      if (!updatedRequest) {
        return reply
          .status(404)
          .send({ message: "POC training request not found" });
      }

      if (
        updatedRequest.trainer_reply_status ===
          PocTrainingRequestStatus.SCHEDULED ||
        updatedRequest.trainer_reply_status ===
          PocTrainingRequestStatus.CANCELLED
      ) {
        withEmailDispatchGuard(fastify.db, {
          dedupeKey: buildPocReplyDedupeKey(updatedRequest),
          entityId: updatedRequest.id,
          entityType: "poc_training_request",
          notificationType: `poc_training_reply_${updatedRequest.trainer_reply_status}`,
          payloadSummary: {
            replyStatus: updatedRequest.trainer_reply_status,
            location: updatedRequest.training_location,
            timeDetails: updatedRequest.training_time_details,
          },
          recipientEmail: updatedRequest.trainee_email,
          send: () =>
            fastify.emailService.sendTrainingRequestReplyEmail({
              traineeName: updatedRequest.trainee_name,
              traineeEmail: updatedRequest.trainee_email,
              deviceName: updatedRequest.lab_name,
              hospitalName: updatedRequest.lab_hospital_name,
              location: updatedRequest.training_location,
              timeDetails: updatedRequest.training_time_details,
              replyStatus:
                updatedRequest.trainer_reply_status ===
                PocTrainingRequestStatus.SCHEDULED
                  ? "scheduled"
                  : "cancelled",
              replyMessage: updatedRequest.trainer_message,
              coordinatorName: updatedRequest.responder_name,
            }),
        })
          .catch((error) => {
            request.log.error(
              { err: error, requestId: updatedRequest.id },
              "Failed to send POCT training reply email",
            );
          });
      }

      return { trainingRequest: updatedRequest };
    }
  );
};

export default pocRegistrationRoutes;
