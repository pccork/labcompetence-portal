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

Run the backend:

```bash
pnpm --filter backend run dev
```

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
