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

## Demo templates linked to Biochemistry sections

| Training Unit | Template Name | Target Staff Type | Template Kind | Owner |
| --- | --- | --- | --- | --- |
| Mass Spectrometry | FOR-CUH-PAT-2 Mass Spectrometry Steroid Panel | basic_grade_scientist | training_event_competency | Sean O'Brien |
| Mass Spectrometry | FOR-CUH-PAT-2 Mass Spectrometry TDM Review | basic_grade_scientist | training_event_competency | Sean O'Brien |
| Mass Spectrometry | FOR-CUH-PAT-2 Mass Spectrometry Senior Trainer Review | senior_medical_scientist | senior_staff_programme | Jack Kenny |
| AU5800 Clinical Chemistry | FOR-CUH-PAT-2 Clinical Chemistry AU5800 | basic_grade_scientist | training_event_competency | Sean O'Brien |
| IDS-i10 | FOR-CUH-PAT-2 IDS-i10 | basic_grade_scientist | training_event_competency | Sean O'Brien |
| DXA 5000 | FOR-CUH-PAT-2 Beckman Coulter DXA 5000 Competency | basic_grade_scientist | competency_only | Sean O'Brien |
| DXA 5000 | FOR-CUH-PAT-2 Beckman DxA 5000 Training Event | basic_grade_scientist | training_event | Sean O'Brien |
| Faecal Calprotectin | FOR-CUH-PAT-2 Faecal Calprotectin | basic_grade_scientist | training_event_competency | Sean O'Brien |
| Dynamic Function Tests | FOR-CUH-PAT-2 Dynamic Function Tests | basic_grade_scientist | training_event_competency | Sean O'Brien |
| Result Authorisation | FOR-CUH-PAT-2 Authorisation of Results | basic_grade_scientist | training_event_competency | Sean O'Brien |
| Senior Staff Biochemistry | FOR-CUH-PAT-2 Senior Medical Scientist Biochemistry | senior_medical_scientist | senior_staff_programme | Jack Kenny |
| Training Co-ordinator | FOR-CUH-PAT-2 Training Co-ordinator | training_coordinator | training_coordinator_programme | Jack Kenny |

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
- Open **Sections** and select each Biochemistry training unit.
- Open **Templates** to see the seeded FOR-CUH-PAT-2 templates from the non-POCT sample forms.
- Open **Due training** to see due dates for Ciara Murphy and Sean O'Brien.
- Open **Records** to see signed-off and pending Mass Spectrometry demo records.
