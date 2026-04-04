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
import { findLabById } from "../services/lab-service";
import {
  createTemplateVersion,
  createTemplateWithInitialVersion,
  findTemplateById,
  findTemplateHospitalScopeById,
  listTemplates,
  updateTemplate,
} from "../services/template-service";

interface TemplateParams {
  Params: {
    id: string;
  };
}

interface TemplateBody {
  Body: {
    name?: string;
    labId?: number;
    formFamilyReference?: string;
    templateKind?: string;
    targetStaffType?: string;
    isActive?: boolean;
    schemaJson?: Record<string, unknown>;
  };
}

interface TemplateVersionBody {
  Body: {
    schemaJson?: Record<string, unknown>;
  };
}

const allowedStaffTypes = new Set<string>(Object.values(StaffType));

function hasTemplateManagerRole(role: Role) {
  return role === Role.ADMIN || role === Role.TRAINER;
}

function sanitizeTemplateBody(body: TemplateBody["Body"]) {
  const name = body.name?.trim();
  const labId = Number(body.labId);
  const formFamilyReference =
    body.formFamilyReference?.trim() || "FOR-CUH-PAT-2";
  const templateKind =
    body.templateKind?.trim() || "training_event_competency";
  const targetStaffType = (
    body.targetStaffType?.trim().toLowerCase() ||
    StaffType.BASIC_GRADE_SCIENTIST
  );
  const isActive = body.isActive ?? true;
  const schemaJson = body.schemaJson;

  return {
    name,
    labId,
    formFamilyReference,
    templateKind,
    targetStaffType,
    isActive,
    schemaJson,
  };
}

const templateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/templates",
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

      const templates = await listTemplates(
        fastify.db,
        resolveScopedHospitalId(scope),
        scope.trainingUnitIds
      );

      return { templates };
    }
  );

  fastify.post<TemplateBody>(
    "/templates",
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
      if (!hasTemplateManagerRole(request.user.role)) {
        return reply.status(403).send({ message: "Forbidden" });
      }

      const {
        name,
        labId,
        formFamilyReference,
        templateKind,
        targetStaffType,
        isActive,
        schemaJson,
      } = sanitizeTemplateBody(request.body);

      if (!name) {
        return reply.status(400).send({ message: "Name is required" });
      }

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Valid labId is required" });
      }

      if (!formFamilyReference) {
        return reply
          .status(400)
          .send({ message: "formFamilyReference is required" });
      }

      if (!templateKind) {
        return reply
          .status(400)
          .send({ message: "templateKind is required" });
      }

      if (!allowedStaffTypes.has(targetStaffType)) {
        return reply
          .status(400)
          .send({ message: "Valid targetStaffType is required" });
      }

      if (typeof isActive !== "boolean") {
        return reply
          .status(400)
          .send({ message: "isActive must be a boolean" });
      }

      if (!schemaJson || typeof schemaJson !== "object") {
        return reply
          .status(400)
          .send({ message: "schemaJson object is required" });
      }

      const lab = await findLabById(fastify.db, labId);

      if (!lab) {
        return reply.status(404).send({ message: "Lab not found" });
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
          message: "You cannot create templates for this lab",
        });
      }

      const template = await createTemplateWithInitialVersion(
        fastify.db,
        {
          name,
          labId,
          createdBy: Number(request.user.id),
          formFamilyReference,
          templateKind,
          targetStaffType: targetStaffType as StaffType,
          isActive,
          schemaJson,
        }
      );

      return reply.status(201).send({ template });
    }
  );

  fastify.get<TemplateParams>(
    "/templates/:id",
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
      const templateId = Number(request.params.id);

      if (!Number.isInteger(templateId) || templateId <= 0) {
        return reply
          .status(400)
          .send({ message: "Invalid template id" });
      }

      const template = await findTemplateById(fastify.db, templateId);

      if (!template) {
        return reply.status(404).send({ message: "Template not found" });
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
          template.lab_hospital_id,
          template.lab_is_poc
        ) ||
        !canAccessTrainingUnit(
          scope,
          template.lab_id,
          template.lab_hospital_id,
          template.lab_is_poc
        )
      ) {
        return reply.status(403).send({
          message: "You cannot access this template",
        });
      }

      return { template };
    }
  );

  fastify.put<TemplateParams & TemplateBody>(
    "/templates/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([Role.ADMIN, Role.TRAINER]),
      ],
    },
    async (request, reply) => {
      const templateId = Number(request.params.id);

      if (!Number.isInteger(templateId) || templateId <= 0) {
        return reply
          .status(400)
          .send({ message: "Invalid template id" });
      }

      const existingTemplateScope =
        await findTemplateHospitalScopeById(fastify.db, templateId);

      if (!existingTemplateScope) {
        return reply.status(404).send({ message: "Template not found" });
      }

      const {
        name,
        labId,
        formFamilyReference,
        templateKind,
        targetStaffType,
        isActive,
      } = sanitizeTemplateBody(request.body);

      if (!name) {
        return reply.status(400).send({ message: "Name is required" });
      }

      if (!Number.isInteger(labId) || labId <= 0) {
        return reply.status(400).send({ message: "Valid labId is required" });
      }

      if (!allowedStaffTypes.has(targetStaffType)) {
        return reply
          .status(400)
          .send({ message: "Valid targetStaffType is required" });
      }

      if (typeof isActive !== "boolean") {
        return reply
          .status(400)
          .send({ message: "isActive must be a boolean" });
      }

      const lab = await findLabById(fastify.db, labId);

      if (!lab) {
        return reply.status(404).send({ message: "Lab not found" });
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
          existingTemplateScope.hospital_id,
          existingTemplateScope.is_poc
        ) ||
        !canAccessTrainingUnit(
          scope,
          existingTemplateScope.lab_id,
          existingTemplateScope.hospital_id,
          existingTemplateScope.is_poc
        ) ||
        !canAccessTrainingUnit(
          scope,
          lab.id,
          lab.hospital_id,
          lab.is_poc
        )
      ) {
        return reply.status(403).send({
          message: "You cannot update this template across this hospital boundary",
        });
      }

      const template = await updateTemplate(fastify.db, {
        templateId,
        name,
        labId,
        formFamilyReference,
        templateKind,
        targetStaffType: targetStaffType as StaffType,
        isActive,
      });

      if (!template) {
        return reply.status(404).send({ message: "Template not found" });
      }

      return { template };
    }
  );

  fastify.post<TemplateParams & TemplateVersionBody>(
    "/templates/:id/versions",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAnyRole([Role.ADMIN, Role.TRAINER]),
      ],
    },
    async (request, reply) => {
      const templateId = Number(request.params.id);
      const schemaJson = request.body.schemaJson;

      if (!Number.isInteger(templateId) || templateId <= 0) {
        return reply
          .status(400)
          .send({ message: "Invalid template id" });
      }

      if (!schemaJson || typeof schemaJson !== "object") {
        return reply
          .status(400)
          .send({ message: "schemaJson object is required" });
      }

      const templateScope = await findTemplateHospitalScopeById(
        fastify.db,
        templateId
      );

      if (!templateScope) {
        return reply.status(404).send({ message: "Template not found" });
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
          templateScope.hospital_id,
          templateScope.is_poc
        ) ||
        !canAccessTrainingUnit(
          scope,
          templateScope.lab_id,
          templateScope.hospital_id,
          templateScope.is_poc
        )
      ) {
        return reply.status(403).send({
          message:
            "You cannot create template versions for this hospital",
        });
      }

      const template = await createTemplateVersion(
        fastify.db,
        templateId,
        schemaJson
      );

      return reply.status(201).send({ template });
    }
  );
};

export default templateRoutes;
