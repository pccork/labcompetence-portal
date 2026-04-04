# Hospital / Lab / Trainee Data Model

This note explains the multi-hospital schema in plain language, so the design can be discussed with laboratory management before the app grows further.

## Design Goal

The app should support:

- one main hospital laboratory with multiple departments
- smaller hospitals with their own labs
- Point of Care (POC) training that may include trainees from different hospitals

The chosen design is **one shared backend with hospital-aware data**, not a cloned standalone POC app.

## Core Principle

Reusable accreditation templates should stay generic.

That means:

- **do not** store trainee names on the base template definition
- **do** store trainee identity on `users`
- **do** display trainee name/email on the derived `training_records`

This avoids duplicating person data inside templates and keeps templates reusable across trainees.

## Main Tables

### `hospitals`

Stores the hospital/site organisation.

Examples:

- CUH
- A smaller satellite hospital

Key fields:

- `id`
- `name`

### `labs`

Stores parent laboratory departments/services.

Each lab belongs to one hospital through `hospital_id`.

Examples:

- CUH Biochemistry
- CUH Point of Care
- Regional Hospital Multidisciplinary Lab

Key fields:

- `id`
- `hospital_id`
- `name`
- `is_poc`

`is_poc = true` marks a Point of Care lab/department. This is important because POC may need a controlled cross-hospital permission exception.

### `training_units`

Stores child sections/devices under a parent lab.

Examples:

- Biochemistry -> Mass Spectrometry
- Biochemistry -> AU5800
- Point of Care -> Blood Gas
- Point of Care -> Glucose Meter

Key fields:

- `id`
- `lab_id`
- `name`

This is the cleaner level where section/device templates, training assignments, and POC QR training requests should attach.

### `users`

Stores staff and trainees.

Each user has a home hospital through `hospital_id`.

Key fields:

- `id`
- `hospital_id`
- `name`
- `email`
- `password`
- `role`

`email` is stored on the user so reminder workflows can contact trainees whose training is due to expire.

### `user_training_units`

Connects users to child training units.

This is a many-to-many table because:

- one person may belong to more than one section/device pathway
- one training unit has many people

Key fields:

- `user_id`
- `training_unit_id`
- `assigned_at`

### `templates`

Stores reusable training/accreditation template definitions.

Each template belongs to a child training unit via `training_unit_id`, but it does **not** store a trainee name.

Key fields:

- `id`
- `name`
- `training_unit_id`
- `created_by`
- `is_active`

### `template_versions`

Stores versioned snapshots of a template structure.

This allows a template to evolve over time while preserving what an older training record was based on.

Key fields:

- `id`
- `template_id`
- `version_number`
- `schema_json`

### `training_records`

Stores a trainee's actual training/accreditation record derived from a template version.

This is where trainee-specific context should be shown by joining to `users`.

Key fields:

- `id`
- `user_id` (the trainee)
- `template_version_id`
- `submitted_at`
- `expires_at`
- `status`

When a training record is returned by the API, the backend joins to `users` so the record can display:

- trainee name
- trainee email

This supports reminder workflows without storing trainee data on the reusable base template.

## Cross-Hospital POC Rule

The intended rule is:

- normal lab admins/trainers manage users and records within their own hospital departments/training units
- POC can be granted a special cross-hospital exception for POC training only

That is why `labs.is_poc` exists.

## Why Not Clone a Separate POC App?

A separate cloned POC app would create duplicated code, duplicated maintenance, and likely inconsistent training records over time.

A single hospital-aware backend keeps the data model consistent while still allowing POC-specific permissions where needed.

## Current Default

The migration seeds one hospital named `CUH` as the default starting organisation for existing records.

More hospitals can be added later without redesigning the whole schema.
