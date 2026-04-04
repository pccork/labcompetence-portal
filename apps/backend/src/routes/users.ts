import { FastifyPluginAsync } from "fastify";
import {
  Role,
  StaffType,
} from "shared-types";

import {
  canAccessHospital,
  getHospitalAccessScope,
  resolveScopedHospitalId,
} from "../services/access-policy-service";
import { findHospitalById } from "../services/hospital-service";
import {
  archiveUser,
  createUser,
  deleteUser,
  findUserById,
  listUsersForRequester,
  updateUser,
  updateUserPassword,
} from "../services/user-service";

interface CreateUserBody {
  Body: {
    hospitalId?: number;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    staffType?: string;
  };
}

interface UserParams {
  Params: {
    id: string;
  };
}

interface UpdatePasswordBody {
  Body: {
    password?: string;
  };
}

interface ArchiveUserBody {
  Body: {
    archive?: boolean;
  };
}

const allowedRoles = new Set<string>(Object.values(Role));
const allowedStaffTypes = new Set<string>(Object.values(StaffType));

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/users",
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

      const users = await listUsersForRequester(fastify.db, {
        hospitalId: resolveScopedHospitalId(scope),
        requesterId: Number(request.user.id),
        requesterRole: request.user.role,
        trainingUnitIds: scope.trainingUnitIds,
      });

      return { users };
    }
  );

  fastify.post<CreateUserBody>(
    "/users",
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
      const hospitalId = Number(request.body.hospitalId);
      const name = request.body.name?.trim();
      const email = request.body.email?.trim().toLowerCase();
      const password = request.body.password?.trim();
      const role = request.body.role?.trim().toLowerCase();
      const staffType = (
        request.body.staffType?.trim().toLowerCase() ||
        StaffType.BASIC_GRADE_SCIENTIST
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

      if (!password) {
        return reply.status(400).send({ message: "Password is required" });
      }

      if (!role || !allowedRoles.has(role)) {
        return reply.status(400).send({ message: "Valid role is required" });
      }

      if (!allowedStaffTypes.has(staffType)) {
        return reply
          .status(400)
          .send({ message: "Valid staffType is required" });
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
          message: "You cannot create users for this hospital",
        });
      }

      try {
        const user = await createUser(
          fastify.db,
          hospitalId,
          name,
          email,
          password,
          role as Role,
          staffType as StaffType
        );

        return reply.status(201).send({ user });
      } catch (error: any) {
        if (error.code === "23505") {
          return reply
            .status(409)
            .send({ message: "User with this email already exists" });
        }

        throw error;
      }
    }
  );

  fastify.get<UserParams>(
    "/users/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

      const user = await findUserById(fastify.db, userId);

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!canAccessHospital(scope, user.hospital_id)) {
        return reply.status(403).send({
          message: "You cannot access this user's hospital",
        });
      }

      if (
        request.user.role === Role.STAFF &&
        Number(request.user.id) !== user.id
      ) {
        return reply.status(403).send({
          message: "You can only access your own profile",
        });
      }

      return { user };
    }
  );

  fastify.put<UserParams & CreateUserBody>(
    "/users/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.id);
      const hospitalId = Number(request.body.hospitalId);
      const name = request.body.name?.trim();
      const email = request.body.email?.trim().toLowerCase();
      const role = request.body.role?.trim().toLowerCase();
      const staffType = (
        request.body.staffType?.trim().toLowerCase() ||
        StaffType.BASIC_GRADE_SCIENTIST
      );

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

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

      if (!role || !allowedRoles.has(role)) {
        return reply.status(400).send({ message: "Valid role is required" });
      }

      if (!allowedStaffTypes.has(staffType)) {
        return reply
          .status(400)
          .send({ message: "Valid staffType is required" });
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

      const existingUser = await findUserById(fastify.db, userId);

      if (!existingUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (
        !canAccessHospital(scope, existingUser.hospital_id) ||
        !canAccessHospital(scope, hospitalId)
      ) {
        return reply.status(403).send({
          message: "You cannot update users across this hospital boundary",
        });
      }

      try {
        const user = await updateUser(
          fastify.db,
          userId,
          hospitalId,
          name,
          email,
          role as Role,
          staffType as StaffType
        );

        if (!user) {
          return reply.status(404).send({ message: "User not found" });
        }

        return { user };
      } catch (error: any) {
        if (error.code === "23505") {
          return reply.status(409).send({
            message: "User with this email already exists",
          });
        }

        throw error;
      }
    }
  );

  fastify.delete<UserParams>(
    "/users/:id",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

      try {
        const scope = await getHospitalAccessScope(
          fastify.db,
          Number(request.user.id)
        );

        if (!scope) {
          return reply.status(404).send({ message: "User not found" });
        }

        const existingUser = await findUserById(fastify.db, userId);

        if (!existingUser) {
          return reply.status(404).send({ message: "User not found" });
        }

        if (!canAccessHospital(scope, existingUser.hospital_id)) {
          return reply.status(403).send({
            message: "You cannot delete users from this hospital",
          });
        }

        const user = await deleteUser(fastify.db, userId);

        if (!user) {
          return reply.status(404).send({ message: "User not found" });
        }

        return { user };
      } catch (error: any) {
        if (error.code === "23503") {
          return reply.status(409).send({
            message: "User cannot be deleted while related records exist",
          });
        }

        throw error;
      }
    }
  );

  fastify.patch<UserParams & UpdatePasswordBody>(
    "/users/:id/password",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.id);
      const password = request.body.password?.trim();

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

      if (!password) {
        return reply.status(400).send({ message: "Password is required" });
      }

      if (password.length < 8) {
        return reply.status(400).send({
          message: "Password must be at least 8 characters long",
        });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const existingUser = await findUserById(fastify.db, userId);

      if (!existingUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!canAccessHospital(scope, existingUser.hospital_id)) {
        return reply.status(403).send({
          message: "You cannot update passwords for this hospital",
        });
      }

      const user = await updateUserPassword(
        fastify.db,
        userId,
        password
      );

      return { user };
    }
  );

  fastify.patch<UserParams & ArchiveUserBody>(
    "/users/:id/archive",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const userId = Number(request.params.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
      }

      if (request.body.archive === false) {
        return reply.status(400).send({
          message: "Only archiving is supported by this endpoint",
        });
      }

      const scope = await getHospitalAccessScope(
        fastify.db,
        Number(request.user.id)
      );

      if (!scope) {
        return reply.status(404).send({ message: "User not found" });
      }

      const existingUser = await findUserById(fastify.db, userId);

      if (!existingUser) {
        return reply.status(404).send({ message: "User not found" });
      }

      if (!existingUser.is_active) {
        return reply.status(200).send({ user: existingUser });
      }

      if (!canAccessHospital(scope, existingUser.hospital_id)) {
        return reply.status(403).send({
          message: "You cannot archive users from this hospital",
        });
      }

      if (existingUser.id === Number(request.user.id)) {
        return reply.status(400).send({
          message: "You cannot archive your own account",
        });
      }

      const user = await archiveUser(fastify.db, userId);

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      return { user };
    }
  );
};

export default userRoutes;
