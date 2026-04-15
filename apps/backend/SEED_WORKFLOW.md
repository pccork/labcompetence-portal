# Seed Workflow

This project supports two seed modes:

- anonymised demo seed stored safely in the GitHub repo
- optional private seed overlay for local or Render-only proof-of-concept data

## Local workflow

### 1. Prepare environment

Make sure the backend `.env` is configured and PostgreSQL is running.

### 2. Run migrations

```bash
pnpm --filter backend run db:init
```

### 3. Seed anonymised demo data only

```bash
pnpm --filter backend run seed
```

### 4. Seed demo data plus your private local overlay

Make sure this ignored file exists:

```bash
apps/backend/private-seed/private-seed.json
```

Then run:

```bash
ENABLE_PRIVATE_SEED=true pnpm --filter backend run seed
```

### 5. Keep the private seed file updated while you work locally

If you want local changes to hospitals, users, sections, templates,
assignments, and records to sync
back into the ignored private seed file automatically, start the backend with:

```bash
AUTO_SYNC_PRIVATE_SEED=true pnpm --filter backend run dev
```

This updates:

- `apps/backend/private-seed/private-seed.json`

after supported create/update/archive actions.

### 6. Manually export the current private local data

If you prefer an explicit sync step, run:

```bash
pnpm --filter backend run export:private-seed
```

### 7. Start the app locally

Backend:

```bash
pnpm --filter backend run dev
```

Frontend:

```bash
pnpm --filter frontend dev
```

## Render workflow

### 1. Push the tracked repo files

This includes:

- `render.yaml`
- anonymised seed logic
- seed documentation

Do not push anything from:

```bash
apps/backend/private-seed/
```

### 2. Create the Blueprint in Render

Render will use:

- [render.yaml](/home/peter-chuk/labcompetence-portal/render.yaml)

### 3. Configure backend environment values

Set:

```bash
JWT_SECRET=<strong-secret>
ENABLE_PRIVATE_SEED=true
PRIVATE_SEED_FILE=/etc/secrets/private-seed.json
```

### 4. Configure frontend environment value

Set:

```bash
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

### 5. Upload the private seed file to Render

In the backend service, add a Render secret file named:

```text
private-seed.json
```

Paste in the contents of your real private Render seed JSON, based on:

```bash
apps/backend/private-seed/private-seed.render.json
```

### 6. Deploy

Deploy the backend, frontend, and database.

### 7. Run migrations in Render

Open the backend service shell and run:

```bash
pnpm --filter backend run db:init
```

### 8. Run seed in Render

Open the backend service shell and run:

```bash
pnpm --filter backend run seed
```

This will:

- seed anonymised demo repo data
- then apply the private Render overlay

### 9. Load the DevOps template library

The split FOR-CUH-PAT-2 template library is tracked in:

```bash
apps/backend/template-samples/template-library.json
```

The manifest includes:

- `apps/backend/template-samples/training-event`
- `apps/backend/template-samples/competency-assessment`

After migrations and seed, rebuild the Form library from those folders:

```bash
pnpm --filter backend run reset:templates
```

### 10. Hand over to the real co-ordinator

Use this checklist:

- `apps/backend/private-seed.example/COORDINATOR_FIRST_RUN_CHECKLIST.md`

## Recommended proof-of-concept approach

For Render, seed only:

- one real co-ordinator/admin account
- essential POCT templates
- minimal required sections

Then ask the co-ordinator to add through the UI:

- real users
- real assignments
- real records
- additional templates

This reduces the amount of sensitive data stored in the private seed file.
