# Backend Setup

This backend uses PostgreSQL and reads its connection settings from `.env`.

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

## Private Seed Guidance

The repo seed is intended to stay anonymised and safe for GitHub.

If you need local or Render-only proof-of-concept data that must not be pushed,
store it outside Git in:

```bash
apps/backend/private-seed/private-seed.json
```

That folder is ignored by Git. An example structure is provided in
`apps/backend/private-seed.example/`.
