# Backend Setup

This backend uses PostgreSQL and reads its connection settings from `.env`.

## Backend Layering

The API is organized around a layered Fastify structure:

- `src/routes`: endpoint registration only; these modules delegate to controllers.
- `src/controllers`: HTTP request and response handling, including parameter extraction and status codes.
- `src/services`: business rules, workflow orchestration, hashing, and cross-repository decisions.
- `src/repositories`: PostgreSQL queries and persistence details.
- `src/schemas`: request/response contracts and validation helpers.
- `src/plugins`: infrastructure setup such as database, auth, and email.
- `src/config`: environment and runtime configuration.

The `users` domain is the reference implementation for the full
controller/service/repository/schema split. Existing domains can be migrated
incrementally into the same pattern without changing their public route URLs.

## Recommended Local Workflow

Use the system PostgreSQL service for now. Once it is installed and enabled, you usually only need to start the API.

Start PostgreSQL if needed:

```bash
sudo systemctl start postgresql
```

Verify the database connection:

```bash
pnpm --filter backend run db:check
```

Initialize the schema safely:

```bash
pnpm --filter backend run db:init
```

Seed the default data:

```bash
pnpm --filter backend run seed
```

Seed the default anonymised demo data plus a private local overlay:

```bash
ENABLE_PRIVATE_SEED=true pnpm --filter backend run seed
```

If your private JSON lives somewhere else:

```bash
PRIVATE_SEED_FILE=/absolute/path/to/private-seed.json ENABLE_PRIVATE_SEED=true pnpm --filter backend run seed
```

Keep the ignored private seed file updated automatically while you work locally:

```bash
AUTO_SYNC_PRIVATE_SEED=true pnpm --filter backend run dev
```

Or export the current private local snapshot on demand:

```bash
pnpm --filter backend run export:private-seed
```

The exporter now includes private users, sections, templates, assignments, and
training records.

Run the backend:

```bash
pnpm --filter backend run dev
```

## Lightweight POCT QR Request Flow

The POCT QR workflow now supports a lighter request-first mode.

The public registration endpoint can accept:

- `hospitalId`
- `name`
- `email`
- `staffType`
- optional `password`

If no password is supplied, the system creates a POCT training request without
forcing an account first. If a matching active user already exists for that
email, the request links to that user automatically. When the coordinator later
schedules the request, the system will attach the POCT training unit to the
linked or matched user where possible.

## Email Setup

Email is controlled by environment variables and supports:

- `disabled` for no outbound mail
- `smtp` for local Mailpit / MailHog or a normal SMTP relay
- `resend` for Render or other hosted environments

Common variables:

```bash
APP_BASE_URL=http://localhost:5173
EMAIL_PROVIDER=disabled
EMAIL_FROM=no-reply@lab.local
```

### Local Mailpit

Run Mailpit locally, then use:

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=no-reply@lab.local
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
```

Mailpit will capture the outgoing mail and show it in its web UI:

```text
http://localhost:8025
```

### Render With Resend

Set these backend environment variables on Render:

```bash
APP_BASE_URL=https://your-frontend.onrender.com
EMAIL_PROVIDER=resend
EMAIL_FROM=no-reply@yourdomain.com
RESEND_API_KEY=your_resend_api_key
```

This is the recommended proof-of-concept setup because API-based sending is
simpler on Render than raw SMTP.

## Microsoft Sign-In

The app now supports both local email/password login and Microsoft Entra ID
login.

Backend auth environment variables:

```bash
AUTH_LOCAL_ENABLED=true
AUTH_MICROSOFT_ENABLED=false
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_ALLOWED_EMAIL_DOMAIN=hse.ie
```

Recommended Microsoft app registration settings:

- Platform: `Web`
- Redirect URI for local development: `http://localhost:5173/`
- Redirect URI for production: your frontend root URL, for example `https://portal.example.com/`
- Supported account type: the single tenant that owns your HSE organisation accounts
- ID tokens: enabled
- Authorization code flow: enabled

How it works:

- The frontend shows a `Continue with Microsoft` button when Microsoft auth is enabled.
- The backend exchanges the Microsoft authorization code and verifies the returned ID token.
- The verified Microsoft email is matched to an existing active user in the local database.
- Local app roles and permissions still come from the Lab Competence Portal database.

For AWS production, a typical setup is:

```bash
APP_BASE_URL=https://your-frontend-domain
AUTH_LOCAL_ENABLED=false
AUTH_MICROSOFT_ENABLED=true
MICROSOFT_TENANT_ID=your-entra-tenant-id
MICROSOFT_CLIENT_ID=your-app-client-id
MICROSOFT_CLIENT_SECRET=your-app-client-secret
MICROSOFT_ALLOWED_EMAIL_DOMAIN=hse.ie
```

That gives you:

- local development: both Microsoft and email/password if you keep `AUTH_LOCAL_ENABLED=true`
- AWS production: Microsoft sign-in only when `AUTH_LOCAL_ENABLED=false`

Important:

- Users must already exist in the app database with the same company email address, such as `peter.chuk@hse.ie`.
- Email matching is case-insensitive.
- If a Microsoft user is not already linked by email, sign-in is rejected.

## One-Time Database Setup

If the role and database do not exist yet:

```bash
sudo -u postgres psql -c "CREATE ROLE labuser WITH LOGIN PASSWORD 'userio58';"
sudo -u postgres psql -c "CREATE DATABASE labcompetence OWNER labuser;"
```

## Helpful Commands

Check whether PostgreSQL is running:

```bash
pg_lsclusters
pg_isready -h localhost -p 5432
```

List tables:

```bash
PGPASSWORD=userio58 psql -h localhost -U labuser -d labcompetence -c "\dt"
```

## Deployment Handoff Notes

For the final Render handoff, these docs are the most useful:

- [APP_USER_GUIDE.md](APP_USER_GUIDE.md) for RBAC, dashboard areas, and user-facing workflow notes
- [DATABASE_SCHEMA_README.md](DATABASE_SCHEMA_README.md) for the SQL data model and quick extension guidance
- [HOSPITAL_SCHEMA_README.md](HOSPITAL_SCHEMA_README.md) for multi-hospital and POCT boundary design

Recommended final checks before the last push:

- confirm the Render plans in the repo [../render.yaml](../render.yaml)
- confirm `APP_BASE_URL`, `JWT_SECRET`, database URL, and email settings in Render
- run migrations and seed the initial dataset
- verify at least one local admin account can sign in and manage templates, assignments, and records
- verify the POCT registration link flow if POCT is part of the POC

## Private Seed Guidance

The repo seed is intended to stay anonymised and safe for GitHub.

If you need local or Render-only proof-of-concept data that must not be pushed,
store it outside Git in:

```bash
apps/backend/private-seed/private-seed.json
```

That folder is ignored by Git. An example structure is provided in
`apps/backend/private-seed.example/`.
