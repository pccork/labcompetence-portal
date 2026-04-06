# Lab Competence Portal

A digital platform for managing laboratory training, competency assessment, renewal tracking, and staff training records across hospital laboratory sections.

## Architecture At A Glance

- `apps/frontend`: React + Vite single-page app for login, dashboard workflows, and POCT self-registration.
- `apps/backend`: Fastify API with PostgreSQL-backed RBAC, training workflows, template versioning, and POCT QR registration flows.
- `packages/shared-types`: shared enums for roles, statuses, and staff categories used by both frontend and backend.
- `render.yaml`: Render blueprint for the frontend static site, backend web service, and managed Postgres database.

## Documentation

- Backend setup and local database workflow: [apps/backend/README.md](apps/backend/README.md)
- User roles, dashboard areas, and workflow guide: [apps/backend/APP_USER_GUIDE.md](apps/backend/APP_USER_GUIDE.md)
- Relational schema and workflow data model: [apps/backend/DATABASE_SCHEMA_README.md](apps/backend/DATABASE_SCHEMA_README.md)
- Multi-hospital and POCT scope notes: [apps/backend/HOSPITAL_SCHEMA_README.md](apps/backend/HOSPITAL_SCHEMA_README.md)
- Project proposal and product design overview: [PROJECT_PROPOSAL.md](PROJECT_PROPOSAL.md)

## Render Deployment Shape

The current Render blueprint is set up for the cheapest always-on proof of concept:

- frontend static site: free
- backend web service: `starter`
- Postgres database: `basic-256mb`

See [render.yaml](render.yaml) for the exact service definition.

## Pre-Hosting Handoff

Before the final push to Render, the most useful documents to review are:

- [apps/backend/APP_USER_GUIDE.md](apps/backend/APP_USER_GUIDE.md) for who can do what in the dashboard
- [apps/backend/DATABASE_SCHEMA_README.md](apps/backend/DATABASE_SCHEMA_README.md) for how the SQL model is arranged
- [apps/backend/README.md](apps/backend/README.md) for environment variables, seeding, and hosted email/auth notes

## Attribution and Disclaimer

This repository was created with the assistance of ChatGPT Codex. The Lab Competence Portal was designed, maintained, and implemented by Peter Chuk, who remains responsible for the project direction, codebase, and technical decisions.
