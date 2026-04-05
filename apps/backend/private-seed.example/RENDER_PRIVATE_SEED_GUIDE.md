# Render Private Seed Guide

## Recommended split

- Keep the GitHub repo on anonymised demo seed data only.
- Keep real or near-real proof-of-concept seed data in a Render secret file.
- Seed only one real co-ordinator account and the minimum templates needed.
- Let the real co-ordinator add the rest of the proof-of-concept data through the app UI.

## Render service commands

Use these values for the backend service:

Build Command:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter backend build
```

Start Command:

```bash
pnpm --filter backend start
```

## Render private seed setup

1. Create a secret file in Render named `private-seed.json`.
2. Paste in the contents of your private seed JSON.
3. Add environment variables:

```bash
ENABLE_PRIVATE_SEED=true
PRIVATE_SEED_FILE=/etc/secrets/private-seed.json
```

4. Deploy the service.
5. Run the seed command once from the service shell:

```bash
pnpm --filter backend run seed
```

This seeds:

- anonymised demo data from the repo
- the private Render overlay from the secret file

## Safer proof-of-concept recommendation

For the Render proof of concept, seed only:

- one real co-ordinator/admin account
- essential POCT templates
- maybe one or two non-sensitive example sections

Then ask the real co-ordinator to add:

- real staff accounts
- real assignments
- real records
- any additional templates

This reduces the amount of sensitive seed data you carry in one file.
