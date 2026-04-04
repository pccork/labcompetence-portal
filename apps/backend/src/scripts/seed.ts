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
      INSERT INTO acknowledgements (training_record_id, trainer_id)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1
        FROM acknowledgements
        WHERE training_record_id = $1
          AND trainer_id = $2
      )
      `,
      [recordId, input.assignedTrainerId]
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

function buildForCuhPat2TemplateSchema(input: {
  sectionName: string;
  title: string;
  eventCode?: string;
  eventDescription?: string;
  eventObjectives?: string[];
  assessmentCode?: string;
  assessmentDescription?: string;
  assessmentObjectives?: string[];
  competencyTasks?: Array<{
    taskLabel: string;
    method: string;
  }>;
  references?: string[];
  additionalSections?: Array<Record<string, unknown>>;
}) {
  return {
    formTitle: "Training Event and Competency Assessment Form",
    formFamilyReference: "FOR-CUH-PAT-2",
    sectionName: input.sectionName,
    documentTitle: input.title,
    sections: [
      ...(input.eventCode
        ? [
            {
              type: "training_event",
              code: input.eventCode,
              description: input.eventDescription ?? "",
              objectives: input.eventObjectives ?? [],
              referenceDocuments: input.references ?? [],
            },
          ]
        : []),
      ...(input.assessmentCode
        ? [
            {
              type: "competency_assessment",
              code: input.assessmentCode,
              description: input.assessmentDescription ?? "",
              objectives: input.assessmentObjectives ?? [],
              tasks: input.competencyTasks ?? [],
              referenceDocuments: input.references ?? [],
            },
          ]
        : []),
      ...(input.additionalSections ?? []),
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
  const au5800UnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "AU5800 Clinical Chemistry",
  });
  const idsI10UnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "IDS-i10",
  });
  const dxa5000UnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "DXA 5000",
  });
  const faecalCalprotectinUnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "Faecal Calprotectin",
  });
  const dynamicFunctionTestsUnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "Dynamic Function Tests",
  });
  const authorisationUnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "Result Authorisation",
  });
  const seniorStaffUnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "Senior Staff Biochemistry",
  });
  const trainingCoordinatorUnitId = await upsertTrainingUnit({
    departmentId: biochemistryDepartmentId,
    name: "Training Co-ordinator",
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
    ...[
      au5800UnitId,
      idsI10UnitId,
      dxa5000UnitId,
      faecalCalprotectinUnitId,
      dynamicFunctionTestsUnitId,
      authorisationUnitId,
      seniorStaffUnitId,
      trainingCoordinatorUnitId,
    ].flatMap((trainingUnitId) => [
      assignUserToLab(adminUserId, trainingUnitId),
      assignUserToLab(jackCoordinatorId, trainingUnitId),
      assignUserToLab(seanTrainerId, trainingUnitId),
    ]),
    ...[
      au5800UnitId,
      idsI10UnitId,
      dxa5000UnitId,
      faecalCalprotectinUnitId,
      dynamicFunctionTestsUnitId,
      authorisationUnitId,
    ].map((trainingUnitId) =>
      assignUserToLab(ciaraScientistId, trainingUnitId)
    ),
  ]);

  console.log("Labs and lab memberships seeded.");

  const steroidTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Mass Spectrometry Steroid Panel",
    labId: massSpecLabId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Mass Spectrometry",
      title: "Mass Spectrometry Steroid Panel Training",
      eventCode: "TE/MS-STEROIDS",
      assessmentCode: "CA/MS-STEROIDS",
      eventDescription:
        "Training on LC-MS/MS steroid panel sample preparation, calibration review, batch setup, peak integration checks, and result authorisation workflow under supervision.",
      eventObjectives: [
        "Prepare patient samples and calibration/QC material for the Mass Spectrometry steroid panel.",
        "Review chromatography and flag integration issues before supervised authorisation.",
        "Follow current SOPs and instrument troubleshooting guidance for Mass Spectrometry batch work.",
      ],
      assessmentDescription:
        "The participant will demonstrate Mass Spectrometry steroid panel competency to a Senior Medical Scientist or nominated trainer using direct observation and result review.",
      assessmentObjectives: [
        "The trainer will deem the participant competent to prepare, process, review, and escalate Mass Spectrometry steroid panel work.",
      ],
      competencyTasks: [
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
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Mass Spectrometry",
      title: "Mass Spectrometry Therapeutic Drug Monitoring Training",
      eventCode: "TE/MS-TDM",
      assessmentCode: "CA/MS-TDM",
      eventDescription:
        "Training on therapeutic drug monitoring sample processing, internal standard review, acceptance criteria, and escalation of failed analytical runs.",
      eventObjectives: [
        "Process TDM samples and review internal standard response acceptance criteria.",
        "Identify failed runs, document corrective actions, and escalate to the senior scientist/trainer.",
      ],
      assessmentDescription:
        "The participant will demonstrate TDM sample processing, analytical run review, and troubleshooting competency under Senior Medical Scientist review.",
      assessmentObjectives: [
        "The trainer will deem the participant competent to complete TDM batch work and escalation documentation.",
      ],
      competencyTasks: [
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
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Mass Spectrometry",
      title: "Mass Spectrometry Senior Scientist Trainer Review",
      eventCode: "TE/MS-SENIOR",
      assessmentCode: "CA/MS-SENIOR",
      eventDescription:
        "Annual senior scientist review for Mass Spectrometry supervision, escalation, assay governance, and trainee support responsibilities.",
      eventObjectives: [
        "Supervise Mass Spectrometry workflow and review trainee competency evidence.",
        "Apply escalation, change-control, and quality governance processes for section incidents and assay updates.",
      ],
      assessmentDescription:
        "Annual senior scientist competency review based on governance records, troubleshooting review, and supervised section signoff activity.",
      assessmentObjectives: [
        "The training co-ordinator will deem the participant competent to supervise, escalate, and support Mass Spectrometry training governance.",
      ],
      competencyTasks: [
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

  const au5800Template = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Clinical Chemistry AU5800",
    labId: au5800UnitId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Clinical Chemistry AU5800",
      title: "Clinical Chemistry AU5800 Training and Competency",
      eventCode: "TE/clinical chemistry au5800",
      assessmentCode: "CA/clinical chemistry au5800",
      eventDescription:
        "The trainee has read, understands and signed off the current revision of the documents associated with this area. Training includes review of SOPs and task-based training for tests run on the AU5800 analyser series.",
      eventObjectives: [
        "Work in Clinical Chemistry on the AU5800 analyser.",
        "Label, process and submit a Clinical Chemistry EQA distribution.",
        "Perform maintenance, reagent loading, calibration, QC, sample processing, and error resolution under supervision before competency assessment.",
      ],
      assessmentDescription:
        "The participant will demonstrate the correct combination of knowledge, skills, and attitude in Clinical Chemistry AU5800 to the Senior Medical Scientist or appointee during competency assessment.",
      assessmentObjectives: [
        "The participant will be deemed competent to perform routine maintenance and reagent loading.",
        "The participant will be deemed competent to perform calibration, QC, sample processing, error resolution, and EQA distribution handling.",
      ],
      competencyTasks: [
        {
          taskLabel: "Routine maintenance and reagent loading",
          method: "DOWP",
        },
        {
          taskLabel: "Calibration and quality control",
          method: "DOWP",
        },
        {
          taskLabel: "Sample processing, error-message review, and resolution",
          method: "DOWP",
        },
        {
          taskLabel: "Clinical Chemistry EQA distribution processing",
          method: "DOWP",
        },
      ],
      references: [
        "PPG-CUH-PAT-1420",
        "PPG-CUH-PAT-200",
        "FOR-CUH-PAT-1423",
        "FOR-CUH-PAT-4041",
        "FOR-CUH-PAT-1459",
        "FOR-CUH-PAT-158",
        "FOR-CUH-PAT-126",
        "INS-CUH-PAT-127",
      ],
    }),
  });

  const idsI10Template = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 IDS-i10",
    labId: idsI10UnitId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "IDS-i10",
      title: "IDS-i10 Training and Competency",
      eventCode: "TE/IDS-i10",
      assessmentCode: "CA/IDS-I10",
      eventDescription:
        "The trainee has read, understands and signed off the current revision of documents associated with this area. Training includes review of SOPs and task-based training for tests run on the IDS-i10 analyser.",
      eventObjectives: [
        "Work on the IDS-i10 analyser.",
        "Perform routine maintenance, calibration, QC, sample processing, error review/resolution, and patient result authorisation under Senior Medical Scientist supervision before competency assessment.",
      ],
      assessmentDescription:
        "The participant will demonstrate the correct combination of knowledge and skills in the IDS-i10 area of Biochemistry to the Senior Medical Scientist or nominated assessor.",
      assessmentObjectives: [
        "The participant will be deemed competent to perform routine IDS-i10 maintenance, calibration, QC, sample processing, error review/resolution, and result authorisation.",
      ],
      competencyTasks: [
        {
          taskLabel:
            "Routine IDS-i10 maintenance, calibration, QC, sample processing, and error resolution",
          method: "DOEM + DOWP",
        },
        {
          taskLabel: "Patient result authorisation",
          method: "DORR",
        },
      ],
      references: [
        "PPG-CUH-PAT-265",
        "EXT-CUH-PAT-4038 IDS i10 User Manual",
        "EXT-CUH-PAT-4039 IDS i10 Application Training Guide",
        "FOR-CUH-PAT-1457",
        "Patient Sample / EQA",
      ],
    }),
  });

  const faecalCalprotectinTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Faecal Calprotectin",
    labId: faecalCalprotectinUnitId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Faecal Calprotectin",
      title: "Faecal Calprotectin Training and Competency",
      eventCode: "TE/Faecal Calprotectin",
      assessmentCode: "CA/Faecal Calprotectin",
      eventDescription:
        "The trainee has read, understands and signed off the current revision of PPG-CUH-PAT-1420.",
      eventObjectives: [
        "Know the cold-room storage area for reagents, calibrator, QC, and CALEX Cap.",
        "Run IQC, check results, and add FCal reagent to the reagent list for analysis days.",
        "Understand EQA sample processing and result authorisation for Faecal Calprotectin.",
      ],
      assessmentDescription:
        "The participant will demonstrate the correct combination of knowledge, skills, and attitude in Faecal Calprotectin to the Senior Medical Scientist or appointee.",
      assessmentObjectives: [
        "The participant will be deemed competent to perform the Faecal Calprotectin assay.",
      ],
      competencyTasks: [
        {
          taskLabel: "Cold-room storage, reagent handling, and CALEX Cap setup",
          method: "DOWP",
        },
        {
          taskLabel: "IQC run, result review, and assay authorisation",
          method: "DOWP",
        },
        {
          taskLabel: "EQA sample processing",
          method: "DOWP",
        },
      ],
      references: [
        "PPG-CUH-PAT-1420",
        "FOR-CUH-PAT-158",
      ],
    }),
  });

  const dxaCompetencyTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Beckman Coulter DXA 5000 Competency",
    labId: dxa5000UnitId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "competency_only",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "DXA 5000",
      title: "Beckman Coulter DXA 5000 Competency Assessment",
      assessmentCode: "CA/Beckman Coulter DXA 5000 automated system",
      assessmentDescription:
        "The participant will demonstrate the correct combination of knowledge, skills, and attitude in maintaining, operating, and troubleshooting the DXA 5000 track system during competency assessment. Training includes SOP review and task-based training for PPG-CUH-PAT-4041.",
      assessmentObjectives: [
        "The participant will be deemed competent to perform daily operation, maintenance, and troubleshooting of the DXA 5000 automated system.",
      ],
      competencyTasks: [
        {
          taskLabel: "DXA 5000 operation and maintenance competency questionnaire",
          method: "WA + DOWP",
        },
        {
          taskLabel: "DXA 5000 troubleshooting and sample flow review",
          method: "DOEM",
        },
      ],
      references: [
        "PPG-CUH-PAT-4041",
        "FOR-CUH-PAT-4063 DXA Competency Questionnaire",
      ],
    }),
  });

  const dxaTrainingTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Beckman DxA 5000 Training Event",
    labId: dxa5000UnitId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "DXA 5000",
      title: "Beckman DxA 5000 Training Event",
      eventCode: "TE/Beckman DxA 5000",
      eventDescription:
        "The trainee understands operation and maintenance of the DxA 5000, using the DxA 5000 in-lab training manual.",
      eventObjectives: [
        "Understand the DxA System Console and the function of each module.",
        "Load samples, unload error racks, and resolve system/sample errors.",
        "Complete daily and weekly maintenance, sample recall, archive/autodisposal handling, and tube robot troubleshooting.",
      ],
      references: ["DxA 5000 In Lab training manual"],
    }),
  });

  const dftTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Dynamic Function Tests",
    labId: dynamicFunctionTestsUnitId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Dynamic Function Tests",
      title: "Dynamic Function Tests Training and Competency",
      eventCode: "TE/Dynamic Function Tests",
      assessmentCode: "CA/Dynamic Function Tests",
      eventDescription:
        "The trainee has read, understands and signed off the current revision of PPG-CUH-PAT-1400. Training includes SOP review and task-based training for tests processed as dynamic function tests.",
      eventObjectives: [
        "Process samples as DFTs.",
        "Book in CSYN, CIST, CGST, CACROG, CCLO/CARG, CLHRH, CTRHT, and CCDC dynamic function tests as applicable.",
        "Authorise DFT samples and understand DFT storage box/scheduled DFT workflows.",
      ],
      assessmentDescription:
        "The participant will demonstrate dynamic function test processing and authorisation competency after SOP review and supervised task-based training.",
      assessmentObjectives: [
        "The participant will be deemed competent to book in, process, authorise, and store/schedule DFT samples appropriately.",
      ],
      competencyTasks: [
        {
          taskLabel: "Book in and process dynamic function test samples",
          method: "DOWP",
        },
        {
          taskLabel: "Authorise DFT samples and manage DFT storage/scheduling",
          method: "DOWP + DORR",
        },
      ],
      references: ["PPG-CUH-PAT-1400"],
    }),
  });

  const authorisationTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Authorisation of Results",
    labId: authorisationUnitId,
    createdBy: seanTrainerId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_event_competency",
    targetStaffType: StaffType.BASIC_GRADE_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Result Authorisation",
      title: "Authorisation of Results Training and Competency",
      eventCode: "TE/AUTHORISATION OF RESULTS",
      assessmentCode: "CA/AUTHORISATION OF RESULTS",
      eventDescription:
        "The trainee has read, understands and signed off the current revision of documents associated with this area. Training includes SOP review and task-based training for PPG-CUH-PAT-264.",
      eventObjectives: [
        "Authorise results in Biochemistry.",
        "Perform Main Lab authorisation for CMISC, CTDM, CROUT, and CDXI under supervision.",
        "Complete the authorisation MCQ booklets for new entrants post 2019.",
      ],
      assessmentDescription:
        "The participant will demonstrate authorisation-of-results competency in Biochemistry Main Lab to the Senior Medical Scientist or appointee.",
      assessmentObjectives: [
        "The participant will be deemed competent for Main Lab Biochemistry authorisation workflows and MCQ completion where required.",
      ],
      competencyTasks: [
        {
          taskLabel: "Main Lab authorisation for CMISC, CTDM, CROUT, and CDXI",
          method: "DOWP",
        },
        {
          taskLabel: "Authorisation MCQ booklet completion for new entrants post 2019",
          method: "WA",
        },
      ],
      references: [
        "PPG-CUH-PAT-264",
        "Patient sample assigned by Senior Medical Scientist during signoff",
      ],
    }),
  });

  const seniorBiochemistryTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Senior Medical Scientist Biochemistry",
    labId: seniorStaffUnitId,
    createdBy: jackCoordinatorId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "senior_staff_programme",
    targetStaffType: StaffType.SENIOR_MEDICAL_SCIENTIST,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Senior Staff Biochemistry",
      title: "Senior Medical Scientist Biochemistry Training and Competency",
      eventCode: "TE/Senior STAFF BIOCHEMISTRY",
      assessmentCode: "CA/Senior Medical Scientist Biochemistry",
      eventDescription:
        "Senior Medical Scientist programme covering quality management, ISO 15189 awareness, health and safety, data protection, leadership, communication, problem-solving, staff performance, and management of equipment, materials, workflow, and processes.",
      eventObjectives: [
        "Understand defined section roles/responsibilities, ISO 15189:2022 requirements, QMS implementation, health and safety, data protection, ethical standards, leadership, communication, problem-solving, and service management.",
        "Support the Chief Medical Scientist and Consultant Clinical Biochemist in the operation and management of the Clinical Chemistry service.",
      ],
      assessmentDescription:
        "Biochemistry Senior Medical Scientist competency assessment based on review of records after participation in the Senior Staff programme.",
      assessmentObjectives: [
        "Comply with the QMS, create a supportive/safe environment, implement staff training and competency programmes, manage documents, equipment, consumables, IQC, EQA, and communication/meetings.",
      ],
      competencyTasks: [
        {
          taskLabel: "QMS, audits, non-conformance/CAPA, and risk management",
          method: "DO/RR",
        },
        {
          taskLabel: "Health and safety, FOI/data protection, and staff/personnel management",
          method: "DO/RR",
        },
        {
          taskLabel: "Document control, equipment maintenance, consumables, IQC, EQA, communication, complaints, change management, and verification/flexible scope",
          method: "DO/RR",
        },
      ],
      references: [
        "FOR-CUH-PAT-1747",
        "FOR-CUH-PAT-1596",
        "INS-CUH-PAT-3002",
        "PPG-CUH-PAT-21",
        "PPG-CUH-PAT-3000",
        "PPG-CUH-PAT-1763",
        "PPG-CUH-PAT-19",
        "PPG-CUH-PAT-26",
        "PPG-CUH-PAT-29",
        "PPG-CUH-PAT-40",
        "PPG-CUH-PAT-8",
        "PPG-CUH-PAT-190",
        "PPG-CUH-PAT-4",
        "INS-CUH-PAT-1407",
        "PPG-CUH-PAT-200",
        "EXT-CUH-PAT-50",
        "INS-CUH-PAT-178",
        "PPG-CUH-PAT-1700",
      ],
      additionalSections: [
        {
          type: "training_methods_and_materials",
          trainingMethods: [
            "PPT presentation",
            "Computer-based",
            "Self study",
            "Observe demonstration",
          ],
          trainingMaterials: [
            "Process flowchart or table",
            "Operator manual / Inserts",
            "Written procedures",
            "Handouts",
            "External courses",
          ],
        },
      ],
    }),
  });

  const trainingCoordinatorTemplate = await upsertTemplateWithVersion({
    name: "FOR-CUH-PAT-2 Training Co-ordinator",
    labId: trainingCoordinatorUnitId,
    createdBy: jackCoordinatorId,
    formFamilyReference: "FOR-CUH-PAT-2",
    templateKind: "training_coordinator_programme",
    targetStaffType: StaffType.TRAINING_COORDINATOR,
    schemaJson: buildForCuhPat2TemplateSchema({
      sectionName: "Training Co-ordinator",
      title: "Training Co-ordinator Training and Competency",
      eventCode: "TE/TRAINING CO-ORDINATOR",
      assessmentCode: "CA/TRAINING CO-ORDINATOR",
      eventDescription:
        "The trainee has read, understands and signed off the current revision of PPG-CUH-PAT-3 Personnel Management and associated documents, and acts as a focal point for training and education in the laboratory.",
      eventObjectives: [
        "Participate in the Laboratory Medicine Training and Education Committee and promote a proactive training and education environment.",
        "Support personnel introduction, review staff performance/development, develop day-to-day training programmes and competencies, record TE/CA on Q-Pulse, review training-system effectiveness, participate in audits, support CPD, and coordinate laboratory students with partner colleges as required.",
        "Confidently participate in and lead training and education activities required by laboratory management.",
      ],
      assessmentDescription:
        "The participant will demonstrate the correct combination of knowledge, skills, and attitude to perform Training Co-ordinator duties to the Chief Medical Scientist during task-based competency assessment.",
      assessmentObjectives: [
        "The Chief Medical Scientist will deem the participant competent to perform the duties of Training Co-ordinator.",
      ],
      competencyTasks: [
        {
          taskLabel: "Attendance and contribution at Training & Education meetings",
          method: "DOWP/RR",
        },
        {
          taskLabel: "Personnel introduction completed and recorded",
          method: "DOWP/RR",
        },
        {
          taskLabel: "Led training session and competency programme and recorded TE/CA on Q-Pulse",
          method: "DOWP/RR",
        },
        {
          taskLabel: "Performance review and audit participation",
          method: "DOWP/RR",
        },
      ],
      references: ["PPG-CUH-PAT-3"],
    }),
  });

  console.log("Biochemistry demo templates seeded from sample FOR-CUH-PAT-2 forms.");

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

  await Promise.all([
    upsertTrainingAssignment({
      userId: ciaraScientistId,
      templateId: au5800Template.templateId,
      labId: au5800UnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(35),
    }),
    upsertTrainingAssignment({
      userId: ciaraScientistId,
      templateId: idsI10Template.templateId,
      labId: idsI10UnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(52),
    }),
    upsertTrainingAssignment({
      userId: ciaraScientistId,
      templateId: faecalCalprotectinTemplate.templateId,
      labId: faecalCalprotectinUnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(21),
    }),
    upsertTrainingAssignment({
      userId: ciaraScientistId,
      templateId: dxaCompetencyTemplate.templateId,
      labId: dxa5000UnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(90),
    }),
    upsertTrainingAssignment({
      userId: ciaraScientistId,
      templateId: dxaTrainingTemplate.templateId,
      labId: dxa5000UnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(89),
    }),
    upsertTrainingAssignment({
      userId: ciaraScientistId,
      templateId: dftTemplate.templateId,
      labId: dynamicFunctionTestsUnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(18),
    }),
    upsertTrainingAssignment({
      userId: ciaraScientistId,
      templateId: authorisationTemplate.templateId,
      labId: authorisationUnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(64),
    }),
    upsertTrainingAssignment({
      userId: seanTrainerId,
      templateId: seniorBiochemistryTemplate.templateId,
      labId: seniorStaffUnitId,
      assignedBy: jackCoordinatorId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(120),
    }),
    upsertTrainingAssignment({
      userId: jackCoordinatorId,
      templateId: trainingCoordinatorTemplate.templateId,
      labId: trainingCoordinatorUnitId,
      assignedBy: adminUserId,
      renewalIntervalMonths: 12,
      nextDueAt: addDays(150),
    }),
  ]);

  console.log("Biochemistry demo assignments seeded.");

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
