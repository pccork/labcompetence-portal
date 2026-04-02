# Backend Database Schema and POC Workflow

This document describes the current PostgreSQL schema and explains how the Point of Care (POC) training workflow differs from ordinary laboratory training.

## High-Level Model

The backend uses one shared multi-hospital schema.

The core design decisions are:

- a user belongs to one home hospital
- a lab belongs to one hospital
- a user can be linked to many labs through `user_labs`
- a template belongs to a lab and is reusable
- a trainee's identity is stored on `users`, not inside the base template
- a training record is the trainee-specific record derived from a template version
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
- `created_at`: row creation timestamp

Important behavior:

- API responses return safe user data and do not expose password hashes
- trainee names/emails shown on training records are read from this table by joins

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
- `is_active`: whether the template is still available for use
- `created_at`: row creation timestamp

Relationships:

- `templates.lab_id -> labs.id`
- `templates.created_by -> users.id`
- one template can have many `template_versions`

Important design rule:

- do not store trainee name or trainee email on `templates`
- templates are reusable definitions, not person-specific records

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

## `training_records`

Stores the trainee-specific record derived from a template version.

Columns:

- `id`: primary key
- `user_id`: trainee user
- `template_version_id`: source template version
- `submitted_at`: submission timestamp
- `expires_at`: expiry date for annual/periodic training reminders
- `status`: `pending`, `submitted`, `signedoff`, or `expired`
- `created_at`: row creation timestamp

Relationships:

- `training_records.user_id -> users.id`
- `training_records.template_version_id -> template_versions.id`
- one training record can have one signoff row in `acknowledgements`

How trainee details are shown:

- when listing or reading training records, the backend joins `training_records` to `users`
- that response includes `trainee_name` and `trainee_email`
- this supports display and reminder emails without copying identity data into base templates

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
