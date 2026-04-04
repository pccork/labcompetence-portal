# Demo Seed Data

Run the seed script after migrations:

```bash
pnpm --filter backend run db:init
pnpm --filter backend run seed
```

## Demo users

All demo users use the password `password123`.

| Name | Email | Password | Role | Staff Type | Demo Purpose |
| --- | --- | --- | --- | --- | --- |
| Portal Admin | admin@test.com | password123 | admin | training_coordinator | Existing global admin account |
| Jack Kenny | jack.kenny@test.com | password123 | admin | training_coordinator | Dummy training co-ordinator for demo setup |
| Sean O'Brien | sean.obrien@test.com | password123 | trainer | senior_medical_scientist | Dummy Mass Spectrometry section trainer |
| Ciara Murphy | ciara.murphy@test.com | password123 | staff | basic_grade_scientist | Dummy medical scientist trainee |

## Demo section / training unit

The seed script creates a parent department **Biochemistry**, a child training unit **Mass Spectrometry**, and links Jack Kenny, Sean O'Brien, and Ciara Murphy to that child training unit.

## Demo templates linked to Mass Spectrometry

| Template Name | Target Staff Type | Form Family | Template Kind | Trainer/Owner |
| --- | --- | --- | --- | --- |
| FOR-CUH-PAT-2 Mass Spectrometry Steroid Panel | basic_grade_scientist | FOR-CUH-PAT-2 | training_event_competency | Sean O'Brien |
| FOR-CUH-PAT-2 Mass Spectrometry TDM Review | basic_grade_scientist | FOR-CUH-PAT-2 | training_event_competency | Sean O'Brien |
| FOR-CUH-PAT-2 Mass Spectrometry Senior Trainer Review | senior_medical_scientist | FOR-CUH-PAT-2 | senior_staff_programme | Jack Kenny |

## Demo training assignments and records

| Trainee | Template | Trainer | Status | Demo Notes |
| --- | --- | --- | --- | --- |
| Ciara Murphy | Mass Spectrometry Steroid Panel | Sean O'Brien | signedoff | Includes two specimen evidence examples and completed checklist notes |
| Ciara Murphy | Mass Spectrometry TDM Review | Sean O'Brien | pending | Upcoming refresher record with one demo specimen placeholder |
| Sean O'Brien | Mass Spectrometry Senior Trainer Review | Jack Kenny | signedoff | Demonstrates that a trainer can also have their own training record |

## What to check in the UI

- Log in as **Jack Kenny** to review admin/co-ordinator style access.
- Log in as **Sean O'Brien** to compare trainer-style access.
- Log in as **Ciara Murphy** to compare ordinary staff/trainee behaviour.
- Open **Sections** and select **Mass Spectrometry**.
- Open **Templates** to see the seeded Mass Spectrometry templates.
- Open **Due training** to see due dates for Ciara Murphy and Sean O'Brien.
- Open **Records** to see signed-off and pending Mass Spectrometry demo records.
