# Backend Layered Architecture Refactor



## Description

This refactor moves the backend toward a cleaner layered Fastify architecture.
Route files now act as thin registration modules, while controllers own HTTP
request/response handling. The users domain has been split further into
controller, service, repository, and schema layers so it can be used as the
reference pattern for migrating the remaining backend domains over time.

The change keeps public API URLs intact while improving separation of concerns:
routes register endpoints, controllers handle HTTP details, services contain
business workflow logic, repositories own database persistence, schemas define
request contracts, and plugins continue to manage infrastructure such as auth,
PostgreSQL, and email.

The backend TypeScript build passes after the refactor.

## High-Level Request Flow

```text
React frontend
  -> Fastify routes
  -> Controllers
  -> Services
  -> Repositories
  -> PostgreSQL
```

## Repository Structure

```text
labcompetence-portal/
├── apps/
│   ├── backend/
│   │   ├── db/
│   │   │   └── migrations/              # PostgreSQL schema migrations
│   │   ├── private-seed.example/        # Example private seed files and setup docs
│   │   ├── src/
│   │   │   ├── config/                  # Environment/runtime configuration
│   │   │   ├── controllers/             # HTTP request/response handling
│   │   │   ├── plugins/                 # Fastify infrastructure: DB, auth, email
│   │   │   ├── repositories/            # Database persistence and SQL queries
│   │   │   ├── routes/                  # Thin endpoint registration modules
│   │   │   ├── schemas/                 # Request/response contracts and validation helpers
│   │   │   ├── scripts/                 # Seed, cleanup, export, and bootstrap scripts
│   │   │   ├── services/                # Business logic and workflow orchestration
│   │   │   └── server.ts                # Fastify server bootstrap
│   │   ├── template-samples/            # Template examples and docs
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── src/
│       │   ├── app/                     # React app shell
│       │   ├── features/                # Feature UI/API modules
│       │   │   ├── auth/                # Login and auth API helpers
│       │   │   ├── dashboard/           # Main dashboard screens and components
│       │   │   └── poc/                 # POCT registration page
│       │   ├── shared/                  # Shared API client, session, and export helpers
│       │   ├── styles/                  # Global theme CSS
│       │   └── main.tsx                 # React entry point
│       ├── package.json
│       └── vite.config.ts
├── docs/                                # Project documentation
├── packages/
│   └── shared-types/
│       └── src/index.ts                 # Shared TypeScript enums/types
├── package.json                         # Workspace root package config
├── pnpm-workspace.yaml                  # Monorepo workspace definition
├── pnpm-lock.yaml
├── tsconfig.base.json                   # Shared TypeScript compiler settings
└── README.md
```

## ASCII Tree Map

```text
labcompetence-portal/
|-- apps/
|   |-- backend/
|   |   |-- db/
|   |   |   `-- migrations/
|   |   |-- private-seed.example/
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |   `-- env.ts
|   |   |   |-- controllers/
|   |   |   |   |-- auth-controller.ts
|   |   |   |   |-- department-controller.ts
|   |   |   |   |-- hospital-controller.ts
|   |   |   |   |-- lab-controller.ts
|   |   |   |   |-- poc-registration-controller.ts
|   |   |   |   |-- template-controller.ts
|   |   |   |   |-- training-assignment-controller.ts
|   |   |   |   |-- training-record-controller.ts
|   |   |   |   |-- user-controller.ts
|   |   |   |   `-- user-lab-controller.ts
|   |   |   |-- plugins/
|   |   |   |   |-- auth.ts
|   |   |   |   |-- email.ts
|   |   |   |   `-- postgres.ts
|   |   |   |-- repositories/
|   |   |   |   `-- user-repository.ts
|   |   |   |-- routes/
|   |   |   |   |-- auth.ts
|   |   |   |   |-- departments.ts
|   |   |   |   |-- hospitals.ts
|   |   |   |   |-- labs.ts
|   |   |   |   |-- poc-registration.ts
|   |   |   |   |-- templates.ts
|   |   |   |   |-- training-assignments.ts
|   |   |   |   |-- training-records.ts
|   |   |   |   |-- user-labs.ts
|   |   |   |   `-- users.ts
|   |   |   |-- schemas/
|   |   |   |   `-- user-schema.ts
|   |   |   |-- scripts/
|   |   |   |   |-- bootstrap-local-poct.ts
|   |   |   |   |-- cleanup-mass-spectrometry-demo.ts
|   |   |   |   |-- export-private-seed.ts
|   |   |   |   |-- reset-demo-passwords.ts
|   |   |   |   `-- seed.ts
|   |   |   |-- services/
|   |   |   |   |-- access-policy-service.ts
|   |   |   |   |-- email-dispatch-service.ts
|   |   |   |   |-- email-service.ts
|   |   |   |   |-- hospital-service.ts
|   |   |   |   |-- lab-service.ts
|   |   |   |   |-- microsoft-auth-service.ts
|   |   |   |   |-- poc-registration-service.ts
|   |   |   |   |-- private-seed-sync-service.ts
|   |   |   |   |-- template-service.ts
|   |   |   |   |-- training-assignment-service.ts
|   |   |   |   |-- training-record-service.ts
|   |   |   |   |-- training-reminder-service.ts
|   |   |   |   |-- user-lab-service.ts
|   |   |   |   `-- user-service.ts
|   |   |   `-- server.ts
|   |   |-- template-samples/
|   |   |-- package.json
|   |   `-- tsconfig.json
|   `-- frontend/
|       |-- src/
|       |   |-- app/
|       |   |   `-- App.tsx
|       |   |-- features/
|       |   |   |-- auth/
|       |   |   |-- dashboard/
|       |   |   `-- poc/
|       |   |-- shared/
|       |   |   |-- api/
|       |   |   |-- export/
|       |   |   `-- session/
|       |   |-- styles/
|       |   |   `-- theme.css
|       |   `-- main.tsx
|       |-- package.json
|       `-- vite.config.ts
|-- docs/
|   |-- backend-layered-architecture.md
|   `-- render-sql-cheatsheet.md
|-- packages/
|   `-- shared-types/
|       |-- src/
|       |   `-- index.ts
|       |-- package.json
|       `-- tsconfig.json
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
|-- README.md
|-- render.yaml
`-- tsconfig.base.json
```

## Backend Layer Responsibilities

### Routes

Routes define the API endpoint registration and delegate to controllers. They
should not contain business logic, database queries, or heavy request handling.

Example:

```ts
import { FastifyPluginAsync } from "fastify";

import userController from "../controllers/user-controller";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  await userController(fastify, {});
};

export default userRoutes;
```

### Controllers

Controllers handle HTTP-level concerns:

- Extract request params, query strings, and bodies
- Return response status codes and payloads
- Call services to perform actual workflows
- Keep Fastify request/reply handling out of services

Examples in this refactor:

- `apps/backend/src/controllers/user-controller.ts`
- `apps/backend/src/controllers/template-controller.ts`
- `apps/backend/src/controllers/poc-registration-controller.ts`

### Services

Services are the business logic layer. They should coordinate workflows and
make business decisions, but avoid embedding raw SQL when a repository exists.

Examples:

- `apps/backend/src/services/user-service.ts`
- `apps/backend/src/services/private-seed-sync-service.ts`
- `apps/backend/src/services/email-service.ts`
- `apps/backend/src/services/training-record-service.ts`

The `users` service now keeps user-specific business behavior such as password
hashing and requester-scoped user listing, while delegating SQL persistence to
the user repository.

### Repositories

Repositories own persistence details:

- PostgreSQL queries
- Insert/update/delete/select logic
- Database row shapes
- Low-level query parameters

Current reference implementation:

- `apps/backend/src/repositories/user-repository.ts`

Future domains can follow the same pattern, for example:

- `hospital-repository.ts`
- `lab-repository.ts`
- `template-repository.ts`
- `training-record-repository.ts`

### Schemas

Schemas define request/response contracts and validation helpers. The current
reference implementation is:

- `apps/backend/src/schemas/user-schema.ts`

It includes user route request body/param types and allowed role/staff-type
sets. This layer can later be expanded with runtime validation using a library
such as Zod or Fastify JSON schemas.

### Plugins

Plugins are infrastructure setup:

- `apps/backend/src/plugins/postgres.ts`: database connection
- `apps/backend/src/plugins/auth.ts`: authentication and authorization helpers
- `apps/backend/src/plugins/email.ts`: email service wiring

### Config

Config contains runtime environment handling:

- `apps/backend/src/config/env.ts`

### Scripts

Scripts contain operational commands for local setup, seed data, exports, and
cleanup:

- `apps/backend/src/scripts/seed.ts`
- `apps/backend/src/scripts/export-private-seed.ts`
- `apps/backend/src/scripts/bootstrap-local-poct.ts`
- `apps/backend/src/scripts/reset-demo-passwords.ts`
- `apps/backend/src/scripts/cleanup-mass-spectrometry-demo.ts`

## What Changed In This Refactor

- Added `apps/backend/src/controllers/`
- Added `apps/backend/src/repositories/`
- Added `apps/backend/src/schemas/`
- Converted backend route files into thin delegators
- Moved existing route handler logic into controller files
- Split the users domain into controller, service, repository, and schema layers
- Removed the deprecated `baseUrl` option from `apps/backend/tsconfig.json`
- Added backend layering notes to `apps/backend/README.md`

## Current Migration State

The backend now has the intended layered shape, and the users domain is the
reference full implementation:

```text
users route
  -> user controller
  -> user service
  -> user repository
  -> PostgreSQL
```

Other backend domains have been moved into controllers but still keep their
existing database access inside service modules. They can be migrated into
repositories incrementally without changing public API URLs.

## Verification

The backend TypeScript build was run successfully:

```bash
pnpm --filter backend build
```
