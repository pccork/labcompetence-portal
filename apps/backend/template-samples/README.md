# Template Samples

Save example competency/training templates in this folder so we can convert them into backend template schemas.

Good file types to place here:

- `.md`
- `.txt`
- `.docx`
- `.pdf`
- `.xlsx`
- exported text copied from a current paper/Word form

Suggested naming examples:

- `blood-gas-competency-template.md`
- `urinalysis-poc-training-form.docx`
- `biochemistry-competency-checklist.pdf`

After saving a file here, tell me the filename and I can inspect it from the repo.

The current reset/import flow expects two folders:

- `training-event/` for initial staff training-event forms.
- `competency-assessment/` for annual competency-assessment forms linked back
  to the matching training event where the filename area matches.

These folders are registered in the DevOps template library manifest:

```bash
apps/backend/template-samples/template-library.json
```

To rebuild the database template setup from those folders, run:

```bash
pnpm --filter backend reset:templates
```

This clears template-dependent records first:

- acknowledgements
- training record specimens
- training records
- training assignments
- template versions
- templates

Then it creates separate `training_event` and `competency_assessment`
templates under CUH / Biochemistry training units. Use `-- --dry-run` first to
check the sample counts without touching the database:

```bash
pnpm --filter backend reset:templates -- --dry-run
```

If a document contains live or confidential working content, do not keep it in
this repo. Store it instead under the ignored local-only path:

```bash
apps/backend/private-seed/
```
