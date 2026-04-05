# Demo Seed Data

Run the seed script after migrations:

```bash
pnpm --filter backend run db:init
pnpm --filter backend run seed
```

## Demo users

All demo users use the password `password123`.

| Name                      | Email                             | Password    | Role    | Staff Type               | Demo Purpose                                            |
| ------------------------- | --------------------------------- | ----------- | ------- | ------------------------ | ------------------------------------------------------- |
| Demo Portal Admin         | portal.admin@example.test         | password123 | admin   | training_coordinator     | Anonymised global admin account                         |
| Demo Training Coordinator | training.coordinator@example.test | password123 | admin   | training_coordinator     | Anonymised biochemistry/core-lab co-ordinator           |
| Demo POCT Coordinator     | poct.coordinator@example.test     | password123 | admin   | training_coordinator     | Anonymised POCT-only co-ordinator for Blood Gas/Glucose |
| Demo Section Trainer      | section.trainer@example.test      | password123 | trainer | senior_medical_scientist | Anonymised Mass Spectrometry section trainer            |
| Demo Scientist Trainee    | scientist.trainee@example.test    | password123 | staff   | basic_grade_scientist    | Anonymised medical scientist trainee                    |

## Demo sections / training units

The seed script creates a parent department **Biochemistry** with child training units seeded from the non-POCT sample forms:

- Mass Spectrometry
- AU5800 Clinical Chemistry
- IDS-i10
- DXA 5000
- Faecal Calprotectin
- Dynamic Function Tests
- Result Authorisation
- Senior Staff Biochemistry
- Training Co-ordinator

It also keeps **Immunology Bench** and POCT device units **Blood Gas** / **Glucose Meter** for dashboard and access-scope testing.

The **Blood Gas** POCT unit now includes anonymised demo templates for:

- `poct_scientist`
- `poct_medical_nursing`

## Demo templates linked to Biochemistry sections

| Training Unit             | Template Name                                                      | Target Staff Type        | Template Kind                  | Owner                     |
| ------------------------- | ------------------------------------------------------------------ | ------------------------ | ------------------------------ | ------------------------- |
| Mass Spectrometry         | FOR-CUH-PAT-2 Mass Spectrometry Steroid Panel                      | basic_grade_scientist    | training_event_competency      | Demo Section Trainer      |
| Mass Spectrometry         | FOR-CUH-PAT-2 Mass Spectrometry TDM Review                         | basic_grade_scientist    | training_event_competency      | Demo Section Trainer      |
| Mass Spectrometry         | FOR-CUH-PAT-2 Mass Spectrometry Senior Trainer Review              | senior_medical_scientist | senior_staff_programme         | Demo Training Coordinator |
| AU5800 Clinical Chemistry | FOR-CUH-PAT-2 Clinical Chemistry AU5800                            | basic_grade_scientist    | training_event_competency      | Demo Section Trainer      |
| IDS-i10                   | FOR-CUH-PAT-2 IDS-i10                                              | basic_grade_scientist    | training_event_competency      | Demo Section Trainer      |
| DXA 5000                  | FOR-CUH-PAT-2 Beckman Coulter DXA 5000 Competency                  | basic_grade_scientist    | competency_only                | Demo Section Trainer      |
| DXA 5000                  | FOR-CUH-PAT-2 Beckman DxA 5000 Training Event                      | basic_grade_scientist    | training_event                 | Demo Section Trainer      |
| Faecal Calprotectin       | FOR-CUH-PAT-2 Faecal Calprotectin                                  | basic_grade_scientist    | training_event_competency      | Demo Section Trainer      |
| Dynamic Function Tests    | FOR-CUH-PAT-2 Dynamic Function Tests                               | basic_grade_scientist    | training_event_competency      | Demo Section Trainer      |
| Result Authorisation      | FOR-CUH-PAT-2 Authorisation of Results                             | basic_grade_scientist    | training_event_competency      | Demo Section Trainer      |
| Senior Staff Biochemistry | FOR-CUH-PAT-2 Senior Medical Scientist Biochemistry                | senior_medical_scientist | senior_staff_programme         | Demo Training Coordinator |
| Training Co-ordinator     | FOR-CUH-PAT-2 Training Co-ordinator                                | training_coordinator     | training_coordinator_programme | Demo Training Coordinator |
| Blood Gas                 | POCT Blood Gas - Scientist Training and Competency                 | poct_scientist           | poct_training_competency       | Demo POCT Coordinator     |
| Blood Gas                 | POCT Blood Gas - Medical/Nursing/Midwifery Training and Competency | poct_medical_nursing     | poct_training_competency       | Demo POCT Coordinator     |

## Demo training assignments and records

| Trainee                | Template                                | Trainer                   | Status    | Demo Notes                                                            |
| ---------------------- | --------------------------------------- | ------------------------- | --------- | --------------------------------------------------------------------- |
| Demo Scientist Trainee | Mass Spectrometry Steroid Panel         | Demo Section Trainer      | signedoff | Includes two specimen evidence examples and completed checklist notes |
| Demo Scientist Trainee | Mass Spectrometry TDM Review            | Demo Section Trainer      | pending   | Upcoming refresher record with one demo specimen placeholder          |
| Demo Section Trainer   | Mass Spectrometry Senior Trainer Review | Demo Training Coordinator | signedoff | Demonstrates that a trainer can also have their own training record   |

## What to check in the UI

- Log in as **Demo Training Coordinator** to review biochemistry/core-lab co-ordinator access.
- Log in as **Demo POCT Coordinator** to review POCT-only co-ordinator access and dashboard scope.
- Log in as **Demo Section Trainer** to compare trainer-style access.
- Log in as **Demo Scientist Trainee** to compare ordinary staff/trainee behaviour.
- Open **Sections** and select each Biochemistry training unit.
- Open **Templates** to see the seeded FOR-CUH-PAT-2 templates from the non-POCT sample forms.
- Open **Due training** to see due dates for the anonymised demo users.
- Open **Records** to see signed-off and pending Mass Spectrometry demo records.

## Private overlay

If you need local or Render-only seed data that must not be pushed to GitHub,
keep it outside Git in:

```bash
apps/backend/private-seed/private-seed.json
```

Run it with:

```bash
ENABLE_PRIVATE_SEED=true pnpm --filter backend run seed
```

An example private overlay structure is provided in
`apps/backend/private-seed.example/private-seed.example.json`.
