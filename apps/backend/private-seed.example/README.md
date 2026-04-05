# Private Seed Overlay

This folder shows the shape of optional private seed data.

Do not place sensitive files in Git-tracked folders. For local or Render-only
proof-of-concept seeding, create this ignored path instead:

```bash
apps/backend/private-seed/private-seed.json
```

Then run:

```bash
ENABLE_PRIVATE_SEED=true pnpm --filter backend run seed
```

Optional:

```bash
PRIVATE_SEED_FILE=/absolute/path/to/private-seed.json ENABLE_PRIVATE_SEED=true pnpm --filter backend run seed
```

The default repo seed remains anonymised and safe for GitHub. The private
overlay is applied only when `ENABLE_PRIVATE_SEED=true`.
