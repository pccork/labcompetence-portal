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
4. A trainer replies with the training location, time, and any extra instructions.
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
- responding to POC training requests with a location, time, and message
- helping keep section templates accurate and practical

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
   Templates define the structure and content of a section training form. If template editing is part of your trainer role, make sure the content reflects current practice and current documents/SOPs.

### POC Trainer Workflow

For POC training requests:

1. A user scans the QR code and submits a training request.
2. The trainer reviews the request, including name, email, hospital, and target POC section.
3. The trainer replies with:
   - training status, for example scheduled
   - location
   - time/date details
   - a message/instruction for the trainee
4. When the request is scheduled, the trainee is linked to the POC lab training pathway.
5. After face-to-face training, the training record should be updated to reflect completion/signoff.

### Important Note For Trainers

Cross-hospital access is intentionally restricted. A trainer can only work beyond their home hospital where the workflow is POC-related and the user is assigned to a POC lab. Ordinary non-POC lab data should remain hospital-scoped unless the user is an admin.

## Guide For Training Co-ordinators / Admins

### What Co-ordinators/Admins Use The App For

Training co-ordinators and admins manage the training system and keep the overall programme organised.

Main responsibilities include:

- creating hospitals and lab sections
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
