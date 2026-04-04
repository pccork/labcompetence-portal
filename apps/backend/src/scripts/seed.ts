import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Pool } from "pg";
import {
  AssignmentStatus,
  Role,
  StaffType,
} from "shared-types";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const demoPassword = "password123";

async function upsertHospital(name: string) {
  const result = await pool.query<{ id: number }>(
    `
    INSERT INTO hospitals (name)
    VALUES ($1)
    ON CONFLICT (name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id
    `,
    [name]
  );

  const hospitalId = result.rows[0]?.id;

  if (!hospitalId) {
    throw new Error(`Failed to seed hospital ${name}`);
  }

  return hospitalId;
}

async function upsertUser(input: {
  hospitalId: number;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  staffType: StaffType;
}) {
  const result = await pool.query<{ id: number }>(
    `
    INSERT INTO users (
      hospital_id,
      name,
      email,
      password,
      role,
      staff_type
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email) DO UPDATE
    SET
      hospital_id = EXCLUDED.hospital_id,
      name = EXCLUDED.name,
      password = EXCLUDED.password,
      role = EXCLUDED.role,
      staff_type = EXCLUDED.staff_type
    RETURNING id
    `,
    [
      input.hospitalId,
      input.name,
      input.email,
      input.passwordHash,
      input.role,
      input.staffType,
    ]
  );

  const userId = result.rows[0]?.id;

  if (!userId) {
    throw new Error(`Failed to seed user ${input.email}`);
  }

  return userId;
}

async function upsertDepartment(input: {
  hospitalId: number;
  name: string;
  isPoc: boolean;
}) {
  const result = await pool.query<{ id: number }>(
    `
    INSERT INTO labs (hospital_id, name, is_poc)
    VALUES ($1, $2, $3)
    ON CONFLICT (hospital_id, name) DO UPDATE
    SET is_poc = EXCLUDED.is_poc
    RETURNING id
    `,
    [
      input.hospitalId,
      input.name,
      input.isPoc,
    ]
  );

  const departmentId = result.rows[0]?.id;

  if (!departmentId) {
    throw new Error(`Failed to seed department ${input.name}`);
  }

  return departmentId;
}

async function upsertTrainingUnit(input: {
  departmentId: number;
  name: string;
}) {
  const result = await pool.query<{ id: number }>(
    `
    INSERT INTO training_units (lab_id, name)
    VALUES ($1, $2)
    ON CONFLICT (lab_id, name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id
    `,
    [input.departmentId, input.name]
  );

  const trainingUnitId = result.rows[0]?.id;

  if (!trainingUnitId) {
    throw new Error(`Failed to seed training unit ${input.name}`);
  }

  return trainingUnitId;
}

async function assignUserToLab(userId: number, labId: number) {
  await pool.query(
    `
    INSERT INTO user_training_units (user_id, training_unit_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, training_unit_id) DO NOTHING
    `,
    [userId, labId]
  );
}

async function upsertTemplateWithVersion(input: {
  name: string;
  labId: number;
  createdBy: number;
  formFamilyReference: string;
  templateKind: string;
  targetStaffType: StaffType;
  schemaJson: Record<string, unknown>;
}) {
  const existingTemplateResult = await pool.query<{ id: number }>(
    `
    SELECT id
    FROM templates
    WHERE training_unit_id = $1
      AND name = $2
      AND target_staff_type = $3
    ORDER BY id ASC
    LIMIT 1
    `,
    [
      input.labId,
      input.name,
      input.targetStaffType,
    ]
  );

  const existingTemplateId = existingTemplateResult.rows[0]?.id;
  const templateId = existingTemplateId
    ? existingTemplateId
    : (
        await pool.query<{ id: number }>(
          `
          INSERT INTO templates (
            name,
            lab_id,
            training_unit_id,
            created_by,
            form_family_reference,
            template_kind,
            target_staff_type,
            is_active
          )
          VALUES (
            $1,
            (SELECT lab_id FROM training_units WHERE id = $2),
            $2,
            $3,
            $4,
            $5,
            $6,
            true
          )
          RETURNING id
          `,
          [
            input.name,
            input.labId,
            input.createdBy,
            input.formFamilyReference,
            input.templateKind,
            input.targetStaffType,
          ]
        )
      ).rows[0]?.id;

  if (!templateId) {
    throw new Error(`Failed to seed template ${input.name}`);
  }

  await pool.query(
    `
    UPDATE templates
    SET
      name = $2,
      lab_id = (SELECT lab_id FROM training_units WHERE id = $3),
      training_unit_id = $3,
      created_by = $4,
      form_family_reference = $5,
      template_kind = $6,
      target_staff_type = $7,
      is_active = true
    WHERE id = $1
    `,
    [
      templateId,
      input.name,
      input.labId,
      input.createdBy,
      input.formFamilyReference,
      input.templateKind,
      input.targetStaffType,
    ]
  );

  const versionResult = await pool.query<{ id: number }>(
    `
    INSERT INTO template_versions (
      template_id,
      version_number,
      schema_json
    )
    VALUES ($1, 1, $2)
    ON CONFLICT (template_id, version_number) DO UPDATE
    SET schema_json = EXCLUDED.schema_json
    RETURNING id
    `,
    [templateId, input.schemaJson]
  );

  const templateVersionId = versionResult.rows[0]?.id;

  if (!templateVersionId) {
    throw new Error(`Failed to seed template version for ${input.name}`);
  }

  return {
    templateId,
    templateVersionId,
  };
}

async function upsertTrainingAssignment(input: {
  userId: number;
  templateId: number;
  labId: number;
  assignedBy: number;
  renewalIntervalMonths: number;
  nextDueAt: string;
}) {
  const result = await pool.query<{ id: number }>(
    `
    INSERT INTO training_assignments (
      user_id,
      template_id,
      lab_id,
      training_unit_id,
      assigned_by,
      renewal_interval_months,
      next_due_at,
      is_active
    )
    VALUES (
      $1,
      $2,
      (SELECT lab_id FROM training_units WHERE id = $3),
      $3,
      $4,
      $5,
      $6,
      true
    )
    ON CONFLICT (user_id, template_id) DO UPDATE
    SET
      lab_id = EXCLUDED.lab_id,
      training_unit_id = EXCLUDED.training_unit_id,
      assigned_by = EXCLUDED.assigned_by,
      renewal_interval_months = EXCLUDED.renewal_interval_months,
      next_due_at = EXCLUDED.next_due_at,
      is_active = true,
      updated_at = NOW()
    RETURNING id
    `,
    [
      input.userId,
      input.templateId,
      input.labId,
      input.assignedBy,
      input.renewalIntervalMonths,
      input.nextDueAt,
    ]
  );

  const assignmentId = result.rows[0]?.id;

  if (!assignmentId) {
    throw new Error(
      `Failed to seed assignment for template ${input.templateId}`
    );
  }

  return assignmentId;
}

async function upsertTrainingRecord(input: {
  traineeId: number;
  templateVersionId: number;
  assignedTrainerId: number;
  trainingAssignmentId: number;
  scheduledAt: string;
  completedAt: string | null;
  traineeSignedAt: string | null;
  expiresAt: string;
  status: AssignmentStatus;
  assessmentPayloadJson: Record<string, unknown>;
  specimens: Array<{
    specimenLabel: string;
    specimenType: string;
    analyserReference: string;
    processedAt: string;
    resultSummary: string;
  }>;
}) {
  const existingRecordResult = await pool.query<{ id: number }>(
    `
    SELECT id
    FROM training_records
    WHERE user_id = $1
      AND template_version_id = $2
      AND training_assignment_id = $3
    ORDER BY id ASC
    LIMIT 1
    `,
    [
      input.traineeId,
      input.templateVersionId,
      input.trainingAssignmentId,
    ]
  );

  const existingRecordId = existingRecordResult.rows[0]?.id;
  const recordId = existingRecordId
    ? existingRecordId
    : (
        await pool.query<{ id: number }>(
          `
          INSERT INTO training_records (
            user_id,
            template_version_id,
            assigned_trainer_id,
            training_assignment_id,
            scheduled_at,
            completed_at,
            trainee_signed_at,
            assessment_payload_json,
            submitted_at,
            expires_at,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
          RETURNING id
          `,
          [
            input.traineeId,
            input.templateVersionId,
            input.assignedTrainerId,
            input.trainingAssignmentId,
            input.scheduledAt,
            input.completedAt,
            input.traineeSignedAt,
            input.assessmentPayloadJson,
            input.expiresAt,
            input.status,
          ]
        )
      ).rows[0]?.id;

  if (!recordId) {
    throw new Error(`Failed to seed record for user ${input.traineeId}`);
  }

  await pool.query(
    `
    UPDATE training_records
    SET
      assigned_trainer_id = $2,
      scheduled_at = $3,
      completed_at = $4,
      trainee_signed_at = $5,
      assessment_payload_json = $6,
      submitted_at = NOW(),
      expires_at = $7,
      status = $8
    WHERE id = $1
    `,
    [
      recordId,
      input.assignedTrainerId,
      input.scheduledAt,
      input.completedAt,
      input.traineeSignedAt,
      input.assessmentPayloadJson,
      input.expiresAt,
      input.status,
    ]
  );

  await pool.query(
    `
    DELETE FROM training_record_specimens
    WHERE training_record_id = $1
    `,
    [recordId]
  );

  for (const specimen of input.specimens) {
    await pool.query(
      `
      INSERT INTO training_record_specimens (
        training_record_id,
        specimen_label,
        specimen_type,
        analyser_reference,
        processed_at,
        result_summary
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        recordId,
        specimen.specimenLabel,
        specimen.specimenType,
        specimen.analyserReference,
        specimen.processedAt,
        specimen.resultSummary,
      ]
    );
  }

  if (input.status === AssignmentStatus.SIGNEDOFF) {
    await pool.query(
      `
      INSERT INTO acknowledgements (training_record_id, user_id)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1
        FROM acknowledgements
        WHERE training_record_id = $1
          AND user_id = $2
      )
      `,
      [recordId, input.traineeId]
    );
  }

  return recordId;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildMassSpectrometryTrainingSchema(input: {
  title: string;
  eventCode: string;
  assessmentCode: string;
  description: string;
  objectives: string[];
  tasks: Array<{
    taskLabel: string;
    method: string;
  }>;
  references: string[];
}) {
  return {
    formTitle: "Training Event and Competency Assessment Form",
    formFamilyReference: "FOR-CUH-PAT-2",
    sectionName: "Mass Spectrometry",
    documentTitle: input.title,
    sections: [
      {
        type: "training_event",
        code: input.eventCode,
        description: input.description,
        objectives: input.objectives,
        referenceDocuments: input.references,
      },
      {
        type: "competency_assessment",
        code: input.assessmentCode,
        tasks: input.tasks,
      },
      {
        type: "signature_block",
        fields: [
          "trainer",
          "scheduled_date",
          "completed_date",
          "trainee_signature_date",
        ],
      },
    ],
  };
}

async function seed() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const cuhHospitalId = await upsertHospital("CUH");

  const adminUserId = await upsertUser({
    hospitalId: cuhHospitalId,
    name: "Portal Admin",
    email: "admin@test.com",
    passwordHash,
    role: Role.ADMIN,
    staffType: StaffType.TRAINING_COORDINATOR,
  });

  const jackCoordinatorId = await upsertUser({
    hospitalId: cuhHospitalId,
    name: "Jack Kenny",
    email: "jack.kenny@test.com",
    passwordHash,
    role: Role.ADMIN,
    staffType: StaffType.TRAINING_COORDINATOR,
  });

  const seanTrainerId = await upsertUser({
    hospitalId: cuhHospitalId,
    name: "Sean O'Brien",
    email: "sean.obrien@test.com",
    passwordHash,
    role: Role.TRAINER,
    staffType: StaffType.SENIOR_MEDICAL_SCIENTIST,
  });

  const ciaraScientistId = await upsertUser({
    hospitalId: cuhHospitalId,
    name: "Ciara Murphy",
    email: "ciara.murphy@test.com",
    passwordHash,
    role: Role.STAFF,
    staffType: StaffType.BASIC_GRADE_SCIENTIST,
  });

  console.log("Demo users seeded.");

  const biochemistryDepartmentId = await upsertDepartment({
    hospitalId: cuhHospitalId,
    name: "Biochemistry",
    isPoc: false,
  });
  const immunologyDepartmentId = await upsertDepartment({
    hospitalId: cuhHospitalId,
    name: "Immunology",
    isPoc: false,
  });
  const pocDepartmentId = await upsertDepartment({
    hospitalId: cuhHospitalId,
    name: "Point of Care",
    isPoc: true,
  });

  const clinicalBiochemistryUnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "Clinical Biochemistry",
  });
  const immunologyUnitId = await upsertTrainingUnit({
    departmentId: immunologyDepartmentId,
    name: "Immunology Bench",
  });
  const bloodGasUnitId = await upsertTrainingUnit({
    departmentId: pocDepartmentId,
    name: "Blood Gas",
  });
  await upsertTrainingUnit({
    departmentId: pocDepartmentId,
    name: "Glucose Meter",
  });
  const massSpecLabId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "Mass Spectrometry",
  });

  await Promise.all([
    assignUserToLab(adminUserId, clinicalBiochemistryUnitId),
    assignUserToLab(adminUserId, bloodGasUnitId),
    assignUserToLab(jackCoordinatorId, massSpecLabId),
    assignUserToLab(seanTrainerId, massSpecLabId),
    assignUserToLab(ciaraScientistId, massSpecLabId),
    assignUserToLab(ciaraScientistId, clinicalBiochemistryUnitId),
    assignUserToLab(seanTrainerId, clinicalBiochemistryUnitId),
    assignUserToLab(jackCoordinatorId, bloodGasUnitId),
    assignUserToLab(adminUserId, immunologyUnitId),
  ]);

  console.log("Labs and lab memberships seeded.");

  const steroidTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Mass Spectrometry Steroid Panel",
    labId: massSpecLabId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildMassSpectrometryTrainingSchema({
      title: "Mass Spectrometry Steroid Panel Training",
      eventCode: "TE/MS-STEROIDS",
      assessmentCode: "CA/MS-STEROIDS",
      description:
        "Training on LC-MS/MS steroid panel sample preparation, calibration review, batch setup, peak integration checks, and result authorisation workflow under supervision.",
      objectives: [
        "Prepare patient samples and calibration/QC material for the Mass Spectrometry steroid panel.",
        "Review chromatography and flag integration issues before supervised authorisation.",
        "Follow current SOPs and instrument troubleshooting guidance for Mass Spectrometry batch work.",
      ],
      tasks: [
        {
          taskLabel: "Sample preparation and batch setup",
          method: "DOWP",
        },
        {
          taskLabel: "Calibration, QC review, and peak integration checks",
          method: "DOEM",
        },
        {
          taskLabel: "Result review and supervised authorisation workflow",
          method: "DORR",
        },
      ],
      references: [
        "FOR-CUH-PAT-2",
        "Mass Spectrometry steroid panel SOP",
        "LC-MS/MS analyser user guide",
      ],
    }),
  });

  const tdmTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Mass Spectrometry TDM Review",
    labId: massSpecLabId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildMassSpectrometryTrainingSchema({
      title: "Mass Spectrometry Therapeutic Drug Monitoring Training",
      eventCode: "TE/MS-TDM",
      assessmentCode: "CA/MS-TDM",
      description:
        "Training on therapeutic drug monitoring sample processing, internal standard review, acceptance criteria, and escalation of failed analytical runs.",
      objectives: [
        "Process TDM samples and review internal standard response acceptance criteria.",
        "Identify failed runs, document corrective actions, and escalate to the senior scientist/trainer.",
      ],
      tasks: [
        {
          taskLabel: "TDM sample processing and analytical batch review",
          method: "DOWP",
        },
        {
          taskLabel: "Failed-run troubleshooting and escalation",
          method: "DOEM",
        },
      ],
      references: [
        "FOR-CUH-PAT-2",
        "Mass Spectrometry TDM SOP",
      ],
    }),
  });

  const seniorTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Mass Spectrometry Senior Trainer Review",
    labId: massSpecLabId,
    createdBy: jackCoordinatorId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "senior_staff_programme",
    targetStaffType: StaffType.SENIOR_MEDICAL_SCIENTIST,
    schemaJson: buildMassSpectrometryTrainingSchema({
      title: "Mass Spectrometry Senior Scientist Trainer Review",
      eventCode: "TE/MS-SENIOR",
      assessmentCode: "CA/MS-SENIOR",
      description:
        "Annual senior scientist review for Mass Spectrometry supervision, escalation, assay governance, and trainee support responsibilities.",
      objectives: [
        "Supervise Mass Spectrometry workflow and review trainee competency evidence.",
        "Apply escalation, change-control, and quality governance processes for section incidents and assay updates.",
      ],
      tasks: [
        {
          taskLabel: "Review of trainee records and section signoff governance",
          method: "DORR",
        },
        {
          taskLabel: "Assay troubleshooting, escalation, and quality documentation",
          method: "DOEM",
        },
      ],
      references: [
        "FOR-CUH-PAT-2",
        "Mass Spectrometry senior scientist competency checklist",
      ],
    }),
  });

  console.log("Mass Spectrometry demo templates seeded.");

  const ciaraSteroidAssignmentId = await upsertTrainingAssignment({
    userId: ciaraScientistId,
    templateId: steroidTemplate.templateId,
    labId: massSpecLabId,
    assignedBy: jackCoordinatorId,
    renewalIntervalMonths: 12,
    nextDueAt: addDays(28),
  });

  const ciaraTdmAssignmentId = await upsertTrainingAssignment({
    userId: ciaraScientistId,
    templateId: tdmTemplate.templateId,
    labId: massSpecLabId,
    assignedBy: jackCoordinatorId,
    renewalIntervalMonths: 12,
    nextDueAt: addDays(8),
  });

  const seanSeniorAssignmentId = await upsertTrainingAssignment({
    userId: seanTrainerId,
    templateId: seniorTemplate.templateId,
    labId: massSpecLabId,
    assignedBy: jackCoordinatorId,
    renewalIntervalMonths: 12,
    nextDueAt: addDays(74),
  });

  console.log("Mass Spectrometry demo assignments seeded.");

  await upsertTrainingRecord({
    traineeId: ciaraScientistId,
    templateVersionId: steroidTemplate.templateVersionId,
    assignedTrainerId: seanTrainerId,
    trainingAssignmentId: ciaraSteroidAssignmentId,
    scheduledAt: isoDaysAgo(48),
    completedAt: isoDaysAgo(42),
    traineeSignedAt: isoDaysAgo(42),
    expiresAt: addDays(28),
    status: AssignmentStatus.SIGNEDOFF,
    assessmentPayloadJson: {
      trainerComments:
        "Ciara completed supervised steroid panel sample preparation, reviewed QC flags correctly, and demonstrated escalation awareness for peak integration anomalies.",
      traineeDeclarationAccepted: true,
      sectionChecklist: [
        {
          task: "Sample preparation and batch setup",
          outcome: "competent",
        },
        {
          task: "QC and chromatography review",
          outcome: "competent",
        },
        {
          task: "Supervised result authorisation workflow",
          outcome: "competent",
        },
      ],
    },
    specimens: [
      {
        specimenLabel: "MS-STER-24011876",
        specimenType: "Serum",
        analyserReference: "LC-MS/MS Steroid Panel",
        processedAt: isoDaysAgo(43),
        resultSummary: "Routine adrenal steroid panel processed under supervision.",
      },
      {
        specimenLabel: "MS-STER-24011893",
        specimenType: "Serum",
        analyserReference: "LC-MS/MS Steroid Panel",
        processedAt: isoDaysAgo(42),
        resultSummary: "Repeat steroid panel with acceptable QC and chromatogram review.",
      },
    ],
  });

  await upsertTrainingRecord({
    traineeId: ciaraScientistId,
    templateVersionId: tdmTemplate.templateVersionId,
    assignedTrainerId: seanTrainerId,
    trainingAssignmentId: ciaraTdmAssignmentId,
    scheduledAt: addDays(2),
    completedAt: null,
    traineeSignedAt: null,
    expiresAt: addDays(8),
    status: AssignmentStatus.PENDING,
    assessmentPayloadJson: {
      trainerComments:
        "Upcoming refresher focused on TDM failed-run troubleshooting and escalation documentation.",
      traineeDeclarationAccepted: false,
      sectionChecklist: [
        {
          task: "Review internal standard acceptance criteria",
          outcome: "pending",
        },
        {
          task: "Document corrective action for failed batch",
          outcome: "pending",
        },
      ],
    },
    specimens: [
      {
        specimenLabel: "MS-TDM-DEMO-001",
        specimenType: "Plasma",
        analyserReference: "LC-MS/MS TDM",
        processedAt: addDays(2),
        resultSummary: "Training specimen placeholder for upcoming TDM refresher.",
      },
    ],
  });

  await upsertTrainingRecord({
    traineeId: seanTrainerId,
    templateVersionId: seniorTemplate.templateVersionId,
    assignedTrainerId: jackCoordinatorId,
    trainingAssignmentId: seanSeniorAssignmentId,
    scheduledAt: isoDaysAgo(18),
    completedAt: isoDaysAgo(11),
    traineeSignedAt: isoDaysAgo(11),
    expiresAt: addDays(74),
    status: AssignmentStatus.SIGNEDOFF,
    assessmentPayloadJson: {
      trainerComments:
        "Sean completed the annual Mass Spectrometry senior trainer review with focus on section supervision and trainee signoff governance.",
      traineeDeclarationAccepted: true,
      sectionChecklist: [
        {
          task: "Governance and escalation review",
          outcome: "competent",
        },
        {
          task: "Trainer support and record review",
          outcome: "competent",
        },
      ],
    },
    specimens: [
      {
        specimenLabel: "MS-SENIOR-REVIEW-2026",
        specimenType: "Governance review",
        analyserReference: "Mass Spectrometry section",
        processedAt: isoDaysAgo(11),
        resultSummary: "Annual review of section training records and escalation logs.",
      },
    ],
  });

  console.log("Mass Spectrometry demo training records seeded.");
  console.table([
    {
      name: "Portal Admin",
      email: "admin@test.com",
      role: Role.ADMIN,
      staffType: StaffType.TRAINING_COORDINATOR,
      password: demoPassword,
    },
    {
      name: "Jack Kenny",
      email: "jack.kenny@test.com",
      role: Role.ADMIN,
      staffType: StaffType.TRAINING_COORDINATOR,
      password: demoPassword,
    },
    {
      name: "Sean O'Brien",
      email: "sean.obrien@test.com",
      role: Role.TRAINER,
      staffType: StaffType.SENIOR_MEDICAL_SCIENTIST,
      password: demoPassword,
    },
    {
      name: "Ciara Murphy",
      email: "ciara.murphy@test.com",
      role: Role.STAFF,
      staffType: StaffType.BASIC_GRADE_SCIENTIST,
      password: demoPassword,
    },
  ]);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
