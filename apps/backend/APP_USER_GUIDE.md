# Lab Competence Portal User Guide

## What This App Is

The Lab Competence Portal is a digital training and competency system for laboratory staff, trainers, and training co-ordinators.

Its purpose is to replace paper-based training records and spreadsheets with one application where:

- staff can see their assigned training and submit evidence
- trainers can review training records and support section-based signoff
- training co-ordinators/admins can manage users, sections, templates, assignments, due dates, and training records
- Point of Care users can request training by scanning a QR code
- training due dates and expiry dates can be tracked more reliably for accreditation

The long-term goal is to make laboratory training easier to manage, easier to audit, and more consistent across one hospital or multiple hospitals, while keeping a clear record of who was trained, on what section, when, and by whom.

## Main User Types

The app is designed around three main working groups:

- **Staff/Trainees**
  People who need to complete training and maintain competence in one or more lab sections.

- **Trainers**
  Senior staff or section trainers who support training delivery, review records, and help sign off competency.

- **Training Co-ordinators/Admins**
  Staff who maintain users, labs, templates, assignments, training schedules, and the overall training picture.

Point of Care (POC) users are also supported through QR-code training requests, especially for medical and nursing staff who may not belong to the main lab team.

## RBAC And Scope

The app currently uses three base roles in code:

- `staff`
- `trainer`
- `admin`

There is also an important admin scope flag:

- `admin + is_global_admin = true`: global admin
- `admin + is_global_admin = false`: local admin / training coordinator

### What Each Role Means

- **Staff**
  Can log in, see their own hospital-scoped data, review their own assignments and records, and use the dashboard mainly as a personal training tracker.

- **Trainer**
  Can log in, see scoped users/templates/sections/assignments/records for their allowed hospital or POCT scope, and review training activity. In the current implementation, trainer visibility is broader than trainer write access.

- **Local Admin / Training Coordinator**
  Can manage the operational workflow for one hospital or one scoped POCT area. This is the main day-to-day management role for creating users, templates, assignments, records, and POCT responses inside the allowed scope.

- **Global Admin**
  Can manage system-wide organisation setup such as hospitals and cross-hospital user administration. In the current UI, this role is intentionally more structural and less workflow-focused.

### Current Feature Matrix

This section reflects the current frontend and backend implementation.

| Area / Action | Staff | Trainer | Local Admin | Global Admin |
| --- | --- | --- | --- | --- |
| Sign in and load dashboard | Yes | Yes | Yes | Yes |
| View hospitals in scope | Yes | Yes | Yes | Yes |
| View users in scope | Yes | Yes | Yes | Yes |
| Create users | No | No | Yes | Yes |
| Archive users | No | No | Yes | Yes |
| Reset passwords by admin endpoint | No | No | Yes | Yes |
| View sections in scope | Yes | Yes | Yes | Yes |
| Create sections | No | No | Yes | Yes |
| Update/delete sections | No | No | No | Global admin only |
| View templates in scope | Yes | Yes | Yes | Yes |
| Create templates | No | No | Yes | No |
| Create new template versions | No | No | Yes | No |
| View assignments in scope | Own only | Yes | Yes | Not loaded in current UI |
| Create/update assignments | No | No | Yes | No |
| View training records in scope | Own only | Yes | Yes | Not loaded in current UI |
| Create training records | Yes, if within allowed scope | Yes, if within allowed scope | Yes | No |
| View POCT registration links | No | No | Yes | No |
| Create POCT registration links | No | No | Yes | No |
| View POCT training requests | No | No | Yes | No |
| Reply to POCT training requests | No | No | Yes | No |
| Create hospitals | No | No | No | Yes |
| Update/delete hospitals | No | No | No | Yes |

### Important Scope Rules

- Most users are limited to their home hospital.
- Global admins can access all hospitals.
- POCT can support a controlled cross-hospital exception when the user is assigned to POCT training units.
- Staff can only see their own assignments and training records.
- Template editing is currently reserved to local admin / training coordinator accounts, not trainers.
- Global admins can view templates across the estate, but template editing/versioning is intentionally blocked for them in the current backend.

## How The App Is Organised

The dashboard is organised into these main areas:

- **Overview**
  Summary of due training, records, templates, and section activity.

- **Users**
  Create and review staff accounts, trainers, and co-ordinators. Core lab users and POC users are separated to keep the directory easier to manage.

- **Due training**
  View and create training assignments, set renewal intervals, and track upcoming due dates.

- **Templates**
  Create reusable section training templates and choose which staff type they apply to.

- **Records**
  Create training records, add specimen evidence, select trainer/reviewer, set training dates, and store assessment notes.

- **Sections**
  View lab sections/instruments and filter the dashboard by section.

## Dashboard Walkthrough

This section explains the main dashboard areas in plain language.

### Overview

The overview is the landing area after login.

- For local admin or training coordinator accounts, it combines metrics with the main operational panels.
- For POCT-only local coordinators, it shows a POCT-focused overview with due items, expiring records, trainer coverage, and section snapshots.
- For global admins, it becomes a system-wide hospital setup view instead of a training workflow view.

### Users

The **Users** area is the staff directory and account setup area.

Main functions:

- create a user account
- choose hospital, role, and staff type
- separate the directory into core lab staff and POCT users
- filter by staff type
- search by name, email, or hospital
- archive users when needed

### Due Training

The **Due training** area is the assignment planner.

Main functions:

- create a new training assignment
- match templates to a user based on `staff_type`
- set renewal interval in months
- set the next due date
- search the assignment list
- export assignment reports

This panel is designed for planning and reminder-style oversight rather than detailed signoff.

### Templates

The **Templates** area manages reusable digital forms.

Main functions:

- create a section template
- choose target staff type
- choose template kind such as competency-only or POCT checklist
- generate the JSON schema for the form structure
- review template versions
- print/export a template document
- archive a template if it should no longer be assigned

Templates describe the reusable form. They do not store trainee-specific answers.

### Records

The **Records** area is where the actual trainee record is created and reviewed.

Main functions:

- create a training record from a template version
- link the record to a trainee and, optionally, a training assignment
- assign trainer/reviewer
- set scheduled, completed, signed, and expiry dates
- capture specimen evidence
- store structured assessment notes in JSON
- export a record document

This is where evidence and signoff history live.

### Section Setup

The **Section setup** or **Lab section directory** area is the section navigator.

Main functions:

- view available training sections
- filter the dashboard by section
- create a new section as a local admin
- mark a section as POCT when required

### POCT Requests

The **POCT requests** area is shown for the POCT coordinator workflow.

Main functions:

- create QR registration links for POCT sections
- print or copy registration links
- group incoming requests by hospital, device, location, and status
- filter requests by status, hospital, device, and search text
- send trainer/coordinator replies with location, time, and a message
- mark requests as `scheduled` or `cancelled`

This area supports high-volume POCT onboarding without manually creating every user first.

## Guide For Staff / Trainees

### What Staff Use The App For

Staff use the app to keep track of their own training and competence records, especially for lab sections they are assigned to.

Examples:

- Biochemistry staff may need competency records for AU5800, IDS-i10, DXA, or other section activities.
- Medical laboratory aides may have section-specific training requirements.
- POC medical and nursing users may request face-to-face training for a device such as a blood gas analyser.

### What Staff Should Do

1. **Log in**
   Use your email and password.

2. **Check your training status**
   Review your assigned training and due dates.

3. **Open or review your training records**
   Check what training has been scheduled, completed, submitted, or signed off.

4. **Provide required evidence**
   For ordinary lab section competency, specimen evidence can be recorded, for example two specimen numbers processed in that section.

5. **Acknowledge or complete your training record**
   When electronic acknowledgement/signoff is available for your workflow, complete it so the record is stored against your training history.

### POC Staff Self-Registration Flow

For Point of Care users, the workflow can start from a QR code placed near a device.

1. Scan the QR code for the POC section/device.
2. Enter your name, hospital, email, and password.
3. Submit the training request.
4. A co-ordinator/admin replies with the training location, time, and any extra instructions.
5. Attend the face-to-face training session.
6. After training, the record is updated and the POC lab assignment is created/stored in the app.

### Important Note For Staff

If you are also a trainer, your account can still have your own training assignments and records. Being a trainer does not prevent you from being a trainee for another section or competency.

## Guide For Trainers

### What Trainers Use The App For

Trainers use the app to support staff training, review section records, and keep evidence of training activity in one place.

Typical trainer work includes:

- checking which staff are due or overdue for training in their section
- reviewing trainee records and specimen evidence
- supporting competency signoff
- supporting POCT sessions after requests have been scheduled by a coordinator/admin
- feeding back on whether templates are practical and up to date

### What Trainers Should Do

1. **Log in**
   Use your trainer account.

2. **Review due training**
   Go to **Due training** to see upcoming or due assignments relevant to staff and sections.

3. **Review training records**
   Go to **Records** to inspect trainee, section, trainer, dates, status, and specimen evidence.

4. **Create or support training records**
   Where appropriate, create a training record using the correct trainee, template version, trainer/reviewer, dates, evidence, and assessment notes.

5. **Use templates carefully**
   Templates define the structure and content of a section training form. In the current implementation, template editing is handled by local admin / training coordinator accounts, so trainers should feed changes back through that workflow.

### POC Trainer Support Workflow

For POC training requests:

1. A user scans the QR code and submits a training request.
2. A local admin / training coordinator reviews the request, including name, email, hospital, and target POC section.
3. The co-ordinator replies with:
   - training status, for example scheduled
   - location
   - time/date details
   - a message/instruction for the trainee
4. The trainer then delivers or supports the face-to-face session.
5. When the request is scheduled, the trainee is linked to the POC lab training pathway.
6. After face-to-face training, the training record should be updated to reflect completion/signoff.

### Important Note For Trainers

Cross-hospital access is intentionally restricted. A trainer can only work beyond their home hospital where the workflow is POC-related and the user is assigned to a POC lab. Ordinary non-POC lab data should remain hospital-scoped unless the user is an admin.

## Guide For Training Co-ordinators / Admins

### What Co-ordinators/Admins Use The App For

Training co-ordinators and admins manage the training system and keep the overall programme organised.

Main responsibilities include:

- creating hospitals where the account is global admin
- creating lab sections within the account's allowed scope
- creating user accounts for ordinary lab staff, trainers, and co-ordinators
- assigning roles and staff types
- creating and maintaining templates
- creating training assignments and setting renewal intervals
- monitoring due and overdue training
- reviewing records for audit and accreditation readiness
- supporting POC registration links and POC training workflows

### Creating Users

Go to **Users** and use the **Create user** form.

Recommended combinations:

- **Training Co-ordinator/Admin**
  - Role: `admin`
  - Staff type: `training_coordinator`

- **Trainer**
  - Role: `trainer`
  - Staff type: usually `senior_medical_scientist` or another relevant staff category

- **Ordinary trainee/staff**
  - Role: `staff`
  - Staff type: `basic_grade_scientist` or `medical_laboratory_aide`

- **POC user**
  - Role: `staff`
  - Staff type: `poct_scientist` or `poct_medical_nursing`

### Creating Templates

Go to **Templates** and create a template for a section.

Useful fields:

- template name
- lab/section
- form family reference, for example `FOR-CUH-PAT-2`
- template type
- target staff type
- template JSON content

The template JSON allows the same form family to support different sections and different staff groups while still keeping a structured digital format.

### Creating Training Assignments

Go to **Due training** and assign a user to a template.

Set:

- trainee/user
- template
- renewal interval in months
- next due date

This is the key mechanism for showing what training is coming due and supporting future reminder emails.

### Creating and Maintaining Training Records

Go to **Records** to create or review records.

Useful fields include:

- linked training assignment
- trainee
- template version
- trainer/reviewer
- scheduled date
- completed date
- trainee sign date
- expiry date
- status
- specimen evidence
- assessment notes in JSON

For ordinary lab sections, two specimen numbers can be used as evidence of practical work completed in that section.

### POC QR Registration Links

For POC sections, admins can create QR registration links tied to a POC lab.

The link can include default training location and time details. A POC user scans the QR code, submits their details, and a training request is created for trainer follow-up.

This avoids manually creating very large numbers of POC medical/nursing users one by one.

## Notes On Current Implementation

There are a few important implementation details to keep in mind before hosting:

- trainer accounts currently have broad read access to scoped workflow data, but the main write actions remain admin-led
- local admins are the main workflow owners for template creation, assignment planning, POCT request replies, and user setup
- global admins are currently aimed at system setup, not day-to-day training record operations
- the UI deliberately separates structure management from live workflow management to reduce accidental cross-hospital edits

## Suggested Operating Model

### Ordinary Lab Sections

1. Admin/co-ordinator creates users and section templates.
2. Admin/co-ordinator creates training assignments for staff.
3. Trainer and trainee complete the training process.
4. Record is updated with specimen evidence and signoff/acknowledgement.
5. Renewal date is tracked for future reminders.

### POC Sections

1. Admin/co-ordinator creates a POC QR registration link for the relevant POC device/section.
2. POC user self-registers by scanning the QR code and submitting a training request.
3. Trainer replies with training location/time details.
4. Face-to-face training occurs.
5. Training record and POC assignment are stored in the app.
6. Future renewal can be handled through a POC-specific competency process, including fixed MCQ questions later.

## Notes For Accreditation And Governance

This app is intended to support a more traceable training and competency process for laboratory accreditation by keeping training events, due dates, evidence, and signoff records in one digital system.

Even though the app does not store patient clinical data, staff training records are still important governance records and should be managed carefully. For production deployment, access control, auditability, backup, secure hosting, and change control should be reviewed before wider rollout.

## Current Practical Limitations

This guide describes the intended workflow and the current structure of the app, but some workflow details may still evolve as trainers and training co-ordinators test the system and give feedback.

Likely future improvements include:

- stronger role-specific UI restrictions
- richer template editing
- easier section assignment workflows
- email reminders
- POC MCQ renewal assessments
- audit trail/report exports for accreditation review

The system is being built so those improvements can be added step by step without returning to paper-based record keeping.
