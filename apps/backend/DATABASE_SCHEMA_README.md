# Backend Database Schema and POC Workflow

This document describes the current PostgreSQL schema and explains how the Point of Care (POC) training workflow differs from ordinary laboratory training.

## High-Level Model

The backend uses one shared multi-hospital schema.

The core design decisions are:

- a user belongs to one home hospital
- a lab belongs to one hospital
- a user can be linked to many labs through `user_labs`
- a template belongs to a lab and is reusable
- templates can target a specific staff category while permission roles remain separate
- recurring training requirements are tracked in `training_assignments`
- a trainee's identity is stored on `users`, not inside the base template
- a training record is the trainee-specific record derived from a template version
- specimen evidence and structured assessment answers are stored on training records, not on the reusable template
- POC labs are marked with `labs.is_poc = true`
- POC QR self-registration creates a `poc_training_requests` row first, not an immediate final lab assignment
- trainer replies can schedule the training and then activate the user-to-POC-lab assignment

## Table-by-Table Schema

## `hospitals`

Stores each hospital/site organisation.

Columns:

- `id`: primary key
- `name`: unique hospital name
- `created_at`: row creation timestamp

Relationship:

- one hospital has many `users`
- one hospital has many `labs`

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
- one user can belong to many labs through `user_labs`
- one user can own templates through `templates.created_by`
- one trainee can have many `training_records`
- one trainer can respond to many `poc_training_requests`

## `labs`

Stores ordinary lab departments and POC departments.

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
- one lab can have many assigned users through `user_labs`
- one lab can own many `templates`
- one POC lab can have many `poc_registration_links`
- one POC lab can receive many `poc_training_requests`

POC difference:

- ordinary labs use normal admin-created users and direct user-lab assignment
- POC labs can expose QR registration links and accept cross-hospital trainee requests

## `user_labs`

Join table for the many-to-many relationship between users and labs.

Columns:

- `user_id`: user reference
- `lab_id`: lab reference
- `assigned_at`: assignment timestamp

Constraints and relationships:

- primary key is `(user_id, lab_id)`, so the same user cannot be assigned to the same lab twice
- `user_id -> users.id`
- `lab_id -> labs.id`

POC difference:

- ordinary lab membership is created directly by admin assignment endpoints
- for POC QR self-registration, membership is created only after a trainer replies with `scheduled`

## `templates`

Stores reusable accreditation/training template definitions at lab level.

Columns:

- `id`: primary key
- `name`: template name
- `lab_id`: owning lab
- `created_by`: user who created the template
- `form_family_reference`: document family/reference, for example `FOR-CUH-PAT-2`
- `template_kind`: broad form shape, for example `training_event_competency`, `competency_only`, `senior_staff_programme`, or `poc_checklist`
- `target_staff_type`: intended staff category for this template
- `is_active`: whether the template is still available for use
- `created_at`: row creation timestamp

Relationships:

- `templates.lab_id -> labs.id`
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
- `training_assignments.assigned_by -> users.id`

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

Stores QR-link registration codes for POC labs.

Columns:

- `id`: primary key
- `lab_id`: POC lab that owns this QR code/link
- `code`: unique public registration code used in the QR URL
- `is_active`: allows old QR links to be disabled
- `default_training_location`: optional default face-to-face training location
- `default_training_time_details`: optional default training timing/instructions
- `created_at`: row creation timestamp

Relationships:

- `poc_registration_links.lab_id -> labs.id`
- one QR link can receive many `poc_training_requests`

POC difference:

- this table should only be used for POC labs
- public self-registration uses this code as the controlled entry point
- the QR link can carry default scheduling text so the trainer does not have to retype location/time every time
- the public QR registration body can also capture whether the user is `poct_scientist` or `poct_medical_nursing`

## `poc_training_requests`

Stores a trainee's self-registration request generated from a POC QR code.

Columns:

- `id`: primary key
- `registration_link_id`: QR link that created this request
- `user_id`: self-registered trainee user
- `lab_id`: target POC lab
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
- `poc_training_requests.responded_by -> users.id`

POC workflow:

- trainee scans QR code and submits self-registration
- backend creates a `users` row and a `poc_training_requests` row
- backend does not immediately create `user_labs`
- request starts as `is_training_approved = true` and `trainer_reply_status = 'pending_trainer_reply'`
- trainer reviews incoming requests and sends time/place details
- if trainer sets reply status to `scheduled`, backend creates the `user_labs` assignment
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
- lab assignment can happen directly through `/users/:userId/labs/:labId`

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

- trainer/admin creates a QR registration link for a POC lab/device
- a POCT scientist or medical/nursing/midwifery trainee self-registers through the public QR link
- trainer sends time/place details and schedules the request
- on `scheduled`, final POC lab membership is created
- the correct POC template can then be assigned through `training_assignments`

Why this model fits the paper-to-digital transition:

- it avoids one SQL table per historical paper form
- it supports simple analyser forms, complex senior/co-ordinator forms, and POCT checklists in one consistent model
- it gives training co-ordinators and section trainers a proper due-date dashboard foundation
- it gives each staff member their own training roadmap
- it leaves room for future AI-generated MCQ/proficiency testing without replacing the relational core
