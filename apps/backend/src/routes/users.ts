import { FastifyPluginAsync } from "fastify";
import { Role } from "shared-types";

import {
  createUser,
  deleteUser,
  findUserById,
  listUsers,
  updateUser,
  updateUserPassword,
} from "../services/user-service";

interface CreateUserBody {
  Body: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
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

const allowedRoles = new Set<string>(Object.values(Role));

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/users",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async () => {
      const users = await listUsers(fastify.db);

      return { users };
    }
  );

  fastify.post<CreateUserBody>(
    "/users",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.ADMIN),
      ],
    },
    async (request, reply) => {
      const name = request.body.name?.trim();
      const email = request.body.email?.trim().toLowerCase();
      const password = request.body.password?.trim();
      const role = request.body.role?.trim().toLowerCase();

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

      try {
        const user = await createUser(
          fastify.db,
          name,
          email,
          password,
          role as Role
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
      const name = request.body.name?.trim();
      const email = request.body.email?.trim().toLowerCase();
      const role = request.body.role?.trim().toLowerCase();

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ message: "Invalid user id" });
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

      try {
        const user = await updateUser(
          fastify.db,
          userId,
          name,
          email,
          role as Role
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

      const user = await updateUserPassword(
        fastify.db,
        userId,
        password
      );

      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      return { user };
    }
  );
};

export default userRoutes;
