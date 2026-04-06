# Backend Database Schema and POC Workflow

This document describes the current PostgreSQL schema and explains how the Point of Care (POC) training workflow differs from ordinary laboratory training.

## High-Level Model

The backend uses one shared multi-hospital schema.

The core design decisions are:

- a user belongs to one home hospital
- a parent department/service belongs to one hospital through `labs`
- each section/instrument/device pathway is a child `training_unit` under one parent department/service
- a user can be linked to many child training units through `user_training_units`
- a template belongs to a child training unit and is reusable
- templates can target a specific staff category while permission roles remain separate
- recurring training requirements are tracked in `training_assignments`
- a trainee's identity is stored on `users`, not inside the base template
- a training record is the trainee-specific record derived from a template version
- specimen evidence and structured assessment answers are stored on training records, not on the reusable template
- POC parent departments are marked with `labs.is_poc = true`
- POC QR self-registration creates a `poc_training_requests` row first, not an immediate final lab assignment
- trainer replies can schedule the training and then activate the user-to-POC-lab assignment

## Relationship Map In Plain English

The fastest way to understand the SQL model is to read it from organisation level down to trainee evidence:

1. `hospitals`
   One row per hospital or site.
2. `labs`
   Parent department or service under one hospital.
3. `training_units`
   Child section, bench, instrument, or device pathway under one lab.
4. `user_training_units`
   Join table connecting users to the training units they belong to.
5. `templates`
   Reusable definition of a form for one training unit.
6. `template_versions`
   Immutable snapshots of the template JSON over time.
7. `training_assignments`
   Reminder/planning rows that say a user must complete or renew a template.
8. `training_records`
   Actual trainee-specific records created from a template version.
9. `training_record_specimens`
   Optional specimen evidence rows attached to one training record.
10. `poc_registration_links`
   Public QR entry points for POCT pathways.
11. `poc_training_requests`
   Incoming request-first rows for POCT trainees before or during scheduling.

If you keep those layers in mind, the model becomes much easier to extend.

## Table-by-Table Schema

## `hospitals`

Stores each hospital/site organisation.

Columns:

- `id`: primary key
- `name`: unique hospital name
- `created_at`: row creation timestamp

Relationship:

- one hospital has many `users`
- one hospital has many parent departments/services in `labs`

## `users`

Stores staff, trainees, trainers, and admins.

Columns:

- `id`: primary key
- `hospital_id`: home hospital of the user
- `name`: user's display name
- `email`: unique login email and reminder email target
- `password`: bcrypt password hash
- `role`: `staff`, `trainer`, or `admin`
- `staff_type`: job/training category used for template targeting and dashboards
- `created_at`: row creation timestamp

Current `staff_type` values:

- `training_coordinator`
- `senior_medical_scientist`
- `basic_grade_scientist`
- `medical_laboratory_aide`
- `poct_scientist`
- `poct_medical_nursing`

Important behavior:

- API responses return safe user data and do not expose password hashes
- trainee names/emails shown on training records are read from this table by joins
- `role` controls what the user can do, while `staff_type` describes which training pathway/forms they belong to

Relationships:

- `users.hospital_id -> hospitals.id`
- one user can belong to many child training units through `user_training_units`
- one user can own templates through `templates.created_by`
- one trainee can have many `training_records`
- one trainer can respond to many `poc_training_requests`

## `labs`

Stores parent laboratory departments/services.

Columns:

- `id`: primary key
- `hospital_id`: owning hospital
- `name`: lab name
- `is_poc`: marks whether this lab is a POC lab
- `created_at`: row creation timestamp

Constraint:

- `(hospital_id, name)` is unique, so two labs in the same hospital cannot share the same name, but different hospitals can reuse a lab name like "Biochemistry"

Relationships:

- `labs.hospital_id -> hospitals.id`
- one parent department/service can have many child `training_units`

POC difference:

- ordinary parent departments use normal admin-created users and child-unit assignment
- POC parent departments can have QR-enabled child device units and accept cross-hospital trainee requests

## `training_units`

Stores child sections, instrument areas, or POCT device pathways under a parent lab/department.

Examples:

- `Biochemistry -> Mass Spectrometry`
- `Biochemistry -> AU5800`
- `Point of Care -> Blood Gas`
- `Point of Care -> Glucose Meter`

Columns:

- `id`: primary key
- `lab_id`: parent department/service reference
- `name`: child section/device/training-unit name
- `created_at`: row creation timestamp

Constraint:

- `(lab_id, name)` is unique, so one department cannot contain duplicate child unit names

Relationships:

- `training_units.lab_id -> labs.id`
- one training unit can have many assigned users through `user_training_units`
- one training unit can own many `templates`
- one POC training unit can have many `poc_registration_links`
- one POC training unit can receive many `poc_training_requests`

## `user_training_units`

Join table for the many-to-many relationship between users and child training units.

Columns:

- `user_id`: user reference
- `training_unit_id`: child section/device reference
- `assigned_at`: assignment timestamp

Constraints and relationships:

- primary key is `(user_id, training_unit_id)`, so the same user cannot be assigned to the same training unit twice
- `user_id -> users.id`
- `training_unit_id -> training_units.id`

POC difference:

- ordinary lab membership is created directly by admin assignment endpoints
- for POC QR self-registration, membership is created only after a trainer replies with `scheduled`

## `templates`

Stores reusable accreditation/training template definitions at child training-unit level.

Columns:

- `id`: primary key
- `name`: template name
- `lab_id`: legacy parent department reference kept in sync from `training_unit_id`
- `training_unit_id`: owning child section/device/training unit
- `created_by`: user who created the template
- `form_family_reference`: document family/reference, for example `FOR-CUH-PAT-2`
- `template_kind`: broad form shape, for example `training_event_competency`, `competency_only`, `senior_staff_programme`, or `poc_checklist`
- `target_staff_type`: intended staff category for this template
- `is_active`: whether the template is still available for use
- `created_at`: row creation timestamp

Relationships:

- `templates.lab_id -> labs.id`
- `templates.training_unit_id -> training_units.id`
- `templates.created_by -> users.id`
- one template can have many `template_versions`

Important design rule:

- do not store trainee name or trainee email on `templates`
- templates are reusable definitions, not person-specific records
- section-specific differences such as IDS-i10, AU5800, DXA 5000, Senior Scientist, and Training Co-ordinator should live in template metadata plus `template_versions.schema_json`, not in separate SQL tables per section

## `template_versions`

Stores versioned snapshots of a template's schema.

Columns:

- `id`: primary key
- `template_id`: parent template
- `version_number`: version sequence number
- `schema_json`: JSONB template structure for that version
- `created_at`: row creation timestamp

Constraint:

- `(template_id, version_number)` is unique

Relationship:

- `template_versions.template_id -> templates.id`
- one template version can be referenced by many `training_records`

Recommended use of `schema_json`:

- represent the common form structure as reusable blocks
- allow optional blocks so some templates can be `training event + competency assessment`, while others can be `competency assessment only`
- store section-specific text, objectives, checklist rows, reference documents, and future quiz metadata in JSON
- keep actual staff answers, signatures, specimen evidence, and completion dates on `training_records`

Example structure:

```json
{
  "formTitle": "Training Event and Competency Assessment Form",
  "formFamilyReference": "FOR-CUH-PAT-2",
  "sections": [
    {
      "type": "training_event",
      "code": "TE/clinical chemistry au5800",
      "description": "The trainee has read, understands and signed off the current revision...",
      "objectives": [
        "Work in Clinical Chemistry area on the AU5800 Analyser",
        "Perform maintenance, calibration, QC and sample processing under supervision"
      ],
      "referenceDocuments": [
        "PPG-CUH-PAT-1420",
        "PPG-CUH-PAT-200"
      ]
    },
    {
      "type": "competency_assessment",
      "code": "CA / clinical chemistry au5800",
      "tasks": [
        {
          "taskLabel": "Routine Maintenance and load reagents",
          "method": "DOWP"
        }
      ]
    },
    {
      "type": "signature_block",
      "fields": [
        "trainer",
        "scheduled_date",
        "completed_date",
        "trainee_signature_date"
      ]
    }
  ]
}
```

For richer Senior Medical Scientist or Training Co-ordinator forms, extra block types can be added in JSON, such as `checkbox_group`, `reference_table`, and `task_comment_table`, without creating a new SQL table for each paper form.

## `training_assignments`

Stores the recurring "this staff member must complete this section/template by this due date" plan.

This table is intended to power:

- staff dashboards showing each person's own upcoming training
- section trainer dashboards showing which staff in their section are due soon
- training co-ordinator dashboards showing the whole service overview
- reminder emails before annual training expires

Columns:

- `id`: primary key
- `user_id`: staff member who needs this training
- `template_id`: required section/template
- `lab_id`: owning lab/section
- `assigned_by`: admin/trainer/co-ordinator who created the assignment
- `renewal_interval_months`: how often retraining is due
- `next_due_at`: next due date used by dashboards/reminders
- `is_active`: whether this training requirement is still active
- `created_at`: row creation timestamp
- `updated_at`: last update timestamp

Constraint:

- `(user_id, template_id)` is unique, so the same person is not assigned the same template repeatedly by mistake

Relationships:

- `training_assignments.user_id -> users.id`
- `training_assignments.template_id -> templates.id`
- `training_assignments.lab_id -> labs.id`
- `training_assignments.training_unit_id -> training_units.id`
- `training_assignments.assigned_by -> users.id`

Implementation note:

- `training_assignments.lab_id` is retained as the parent department reference for compatibility/reporting
- `training_assignments.training_unit_id` is the main child section/device reference that dashboards should group by

## `training_records`

Stores the trainee-specific record derived from a template version.

Columns:

- `id`: primary key
- `user_id`: trainee user
- `template_version_id`: source template version
- `assigned_trainer_id`: trainer responsible for this specific record
- `training_assignment_id`: optional link to the recurring assignment this record came from
- `scheduled_at`: planned training/assessment date
- `completed_at`: completion date
- `trainee_signed_at`: trainee declaration/signature date
- `assessment_payload_json`: structured checklist answers, comments, initials, and future MCQ/proficiency results
- `submitted_at`: submission timestamp
- `expires_at`: expiry date for annual/periodic training reminders
- `status`: `pending`, `submitted`, `signedoff`, or `expired`
- `created_at`: row creation timestamp

Relationships:

- `training_records.user_id -> users.id`
- `training_records.template_version_id -> template_versions.id`
- `training_records.assigned_trainer_id -> users.id`
- `training_records.training_assignment_id -> training_assignments.id`
- one training record can have one signoff row in `acknowledgements`
- one training record can have many specimen evidence rows in `training_record_specimens`

How trainee details are shown:

- when listing or reading training records, the backend joins `training_records` to `users`
- that response includes `trainee_name` and `trainee_email`
- this supports display and reminder emails without copying identity data into base templates

How `assessment_payload_json` should be used:

- instrument forms can store checklist completion, method selections, reviewer comments, and initials
- Senior Scientist / Training Co-ordinator forms can store checkbox choices and activity/task comments
- POCT forms can store row-level trainee/trainer initials and declaration text
- future LLM-generated MCQ sections can store generated question ids, selected answers, scores, and explanations

## `training_record_specimens`

Stores specimen or case evidence linked to a training record.

This supports the current workflow where staff record specimen examples they processed as evidence of proficiency.

Columns:

- `id`: primary key
- `training_record_id`: parent training record
- `specimen_label`: sample/accession/specimen reference entered by staff
- `specimen_type`: optional specimen category
- `analyser_reference`: optional instrument/analyser reference
- `processed_at`: when the specimen was processed
- `result_summary`: optional short note describing the evidence or result context
- `created_at`: row creation timestamp

Relationship:

- `training_record_specimens.training_record_id -> training_records.id`

Why this is separate from `assessment_payload_json`:

- specimen evidence is stable, searchable, and useful for audit/reporting
- checklist and quiz responses are more variable and fit better in JSON

## `acknowledgements`

Stores trainer signoff for a training record.

Columns:

- `id`: primary key
- `training_record_id`: training record being signed off
- `trainer_id`: trainer who acknowledged/signed off
- `acknowledged_at`: signoff timestamp

Constraint:

- `training_record_id` is unique, so each training record can only have one acknowledgement row

Relationships:

- `acknowledgements.training_record_id -> training_records.id`
- `acknowledgements.trainer_id -> users.id`

## `poc_registration_links`

Stores QR-link registration codes for child POCT device training units.

Columns:

- `id`: primary key
- `lab_id`: legacy parent POC department reference kept in sync from `training_unit_id`
- `training_unit_id`: child POC device unit that owns this QR code/link
- `code`: unique public registration code used in the QR URL
- `is_active`: allows old QR links to be disabled
- `default_training_location`: optional default face-to-face training location
- `default_training_time_details`: optional default training timing/instructions
- `created_at`: row creation timestamp

Relationships:

- `poc_registration_links.lab_id -> labs.id`
- `poc_registration_links.training_unit_id -> training_units.id`
- one QR link can receive many `poc_training_requests`

POC difference:

- this table should only be used for POC child training units under a POC parent department
- public self-registration uses this code as the controlled entry point
- the QR link can carry default scheduling text so the trainer does not have to retype location/time every time
- the public QR registration body can also capture whether the user is `poct_scientist` or `poct_medical_nursing`

## `poc_training_requests`

Stores a trainee's self-registration request generated from a POC QR code.

Columns:

- `id`: primary key
- `registration_link_id`: QR link that created this request
- `user_id`: self-registered trainee user
- `lab_id`: legacy parent POC department reference kept in sync from `training_unit_id`
- `training_unit_id`: target child POC device training unit
- `is_training_approved`: currently defaults to `true`, meaning the trainee is approved to undertake training without an extra approval step
- `trainer_reply_status`: `pending_trainer_reply`, `scheduled`, or `cancelled`
- `training_location`: location sent by trainer, optionally copied from the QR link default
- `training_time_details`: time/session details sent by trainer, optionally copied from the QR link default
- `trainer_message`: free-text note from trainer
- `responded_by`: trainer/admin who replied
- `responded_at`: reply timestamp
- `requested_at`: request creation timestamp

Constraint:

- `(registration_link_id, user_id)` is unique, so the same user cannot submit the same QR registration request twice

Relationships:

- `poc_training_requests.registration_link_id -> poc_registration_links.id`
- `poc_training_requests.user_id -> users.id`
- `poc_training_requests.lab_id -> labs.id`
- `poc_training_requests.training_unit_id -> training_units.id`
- `poc_training_requests.responded_by -> users.id`

POC workflow:

- trainee scans QR code and submits self-registration
- backend creates a `users` row and a `poc_training_requests` row
- backend does not immediately create `user_training_units`
- request starts as `is_training_approved = true` and `trainer_reply_status = 'pending_trainer_reply'`
- trainer reviews incoming requests and sends time/place details
- if trainer sets reply status to `scheduled`, backend creates the `user_training_units` assignment
- this means "approved for training" is separate from "passed/signed off training"

## Authorization Model

Current backend rule:

- ordinary admins/trainers are restricted to their own hospital by default
- users and labs list endpoints remain home-hospital scoped
- cross-hospital access is allowed only for POC-related work
- POC cross-hospital permission is granted when a user is assigned to a POC lab
- non-POC records and non-POC lab management remain hospital-scoped

Practical meaning:

- a normal CUH lab admin cannot manage another hospital's ordinary biochemistry lab
- a POC trainer/admin can work with POC trainees from other hospitals
- that POC exception does not become a blanket all-hospitals permission for ordinary lab work

## Why POC Is Different from Ordinary Labs

Ordinary lab training:

- users are usually created and assigned by admin staff
- training is mainly hospital-local
- child section/device assignment can happen directly through `/users/:userId/labs/:labId`
- in the current API route name, `labId` now refers to a child `training_units.id`

POC training:

- trainees may come from multiple hospitals
- the POC device can expose a QR code
- scanning the QR code triggers self-registration
- trainer's job becomes replying with time/place details and scheduling, not manually creating every trainee account
- final POC lab assignment is delayed until trainer replies with `scheduled`

## Current Implementation Note

The backend currently models the POC trainer reply workflow and assignment creation, but it does **not** send email automatically yet.

`poc_training_requests` stores the trainee email indirectly through `users.email`, and stores the trainer reply text/time/place. That gives us the database foundation for a future email notification job or email-sending endpoint.

## Suggested Digital Operating Model

Ordinary Biochemistry / non-POC labs:

- admin or training co-ordinator creates staff users and sets both `role` and `staff_type`
- staff are assigned required section templates through `training_assignments`
- each user can later see their own due-soon items from `training_assignments.next_due_at`
- section trainers can view the same assignment data filtered to their section
- when an event starts, a trainee-specific `training_record` is created from the relevant `template_version`
- staff enter specimen evidence into `training_record_specimens`
- trainer/staff checklist answers, comments, and initials are captured in `assessment_payload_json`
- trainer signoff is stored in `acknowledgements`

POC labs:

- trainer/admin creates a QR registration link for a child POCT device unit
- a POCT scientist or medical/nursing/midwifery trainee self-registers through the public QR link
- trainer sends time/place details and schedules the request
- on `scheduled`, final POC training-unit membership is created
- the correct POC template can then be assigned through `training_assignments`

Why this model fits the paper-to-digital transition:

- it avoids one SQL table per historical paper form
- it supports simple analyser forms, complex senior/co-ordinator forms, and POCT checklists in one consistent model
- it gives training co-ordinators and section trainers a proper due-date dashboard foundation
- it gives each staff member their own training roadmap
- it leaves room for future AI-generated MCQ/proficiency testing without replacing the relational core
## Why This Model Makes New Features Quicker

The current structure is deliberately arranged so new functions usually fit into one of two places:

- add a new SQL query, filter, or endpoint over existing relational tables
- add a new JSON block inside `template_versions.schema_json` or `training_records.assessment_payload_json`

This means we usually do **not** need:

- a brand-new SQL table for every paper form
- separate apps for core lab and POCT
- duplicated trainee identity fields on templates

That design makes future changes faster because the core joins stay stable:

- hospital filtering starts at `users.hospital_id` or `labs.hospital_id`
- section filtering starts at `training_units` and `user_training_units`
- template filtering starts at `templates.target_staff_type`, `template_kind`, or `is_active`
- reminder filtering starts at `training_assignments.next_due_at` or `training_records.expires_at`
- POCT filtering starts at `labs.is_poc`

## How To Think About New Filters

Most new filters can be added quickly because the list endpoints already return denormalised summary rows.

Common examples:

- **Filter by hospital**
  Join through `users.hospital_id` for trainee ownership or `labs.hospital_id` for section ownership.

- **Filter by department or section**
  Use `training_units.lab_id` or the returned `department_id` and `lab_id` fields from the list queries.

- **Filter by staff category**
  Use `users.staff_type` for trainee category or `templates.target_staff_type` for template applicability.

- **Filter by due / expiry window**
  Use `training_assignments.next_due_at` or `training_records.expires_at`.

- **Filter POCT versus non-POCT**
  Use `labs.is_poc`.

- **Filter active versus archived**
  Use `users.is_active`, `templates.is_active`, or `training_assignments.is_active`.

Because the app already exposes these summary fields in the dashboard APIs, many future UI filters should only require:

1. adding a query parameter or frontend filter control
2. extending the SQL `WHERE` clause in one service
3. returning the same summary shape

## How To Think About New Functions

Most future functions naturally fit one of these extension paths:

- **New report**
  Usually built from existing assignment or record list queries plus export formatting.

- **New reminder rule**
  Usually built from date logic on `training_assignments` or `training_records`.

- **New form type**
  Usually built by extending `template_versions.schema_json` with another block type instead of creating another table.

- **New evidence type**
  Can go into `training_record_specimens` if row-based, or `assessment_payload_json` if it is structured form data.

- **New role-aware dashboard view**
  Usually built from the same list endpoints with an additional scope filter or metric aggregate.

- **New POCT workflow step**
  Usually built from `poc_training_requests` plus status transitions, rather than creating a separate POCT-only schema.

## Practical Query Starting Points

If a new feature needs to be added quickly, these are the best starting anchors:

- `users` for identity, role, staff type, and home hospital
- `user_training_units` for section membership and scoped access
- `templates` and `template_versions` for reusable form logic
- `training_assignments` for due-date planning
- `training_records` for compliance evidence and audit output
- `poc_training_requests` for intake and scheduling workflows

In practice, that means a new filter or report should usually begin by asking:

- Is this about **who the person is**? Start from `users`.
- Is this about **where they work/train**? Start from `training_units` and `user_training_units`.
- Is this about **what form applies**? Start from `templates`.
- Is this about **what is due**? Start from `training_assignments`.
- Is this about **what was completed**? Start from `training_records`.
- Is this about **public POCT intake**? Start from `poc_training_requests`.
