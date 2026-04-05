import fs from "fs";
import path from "path";

import { Pool } from "pg";

const demoEmailSuffix = "@example.test";
const autoSyncPrivateSeed = process.env.AUTO_SYNC_PRIVATE_SEED === "true";
const privateSeedFilePath = process.env.PRIVATE_SEED_FILE
  ? path.resolve(process.env.PRIVATE_SEED_FILE)
  : path.resolve(__dirname, "../../private-seed/private-seed.json");

interface PrivateSeedUserRecord {
  id: number;
  hospital_name: string;
  name: string;
  email: string;
  password: string;
  role: string;
  staff_type: string;
  training_unit_names: string[] | null;
}

interface IncludedTrainingUnitRecord {
  id: number;
  hospital_name: string;
  department_name: string;
  name: string;
  is_poc: boolean;
}

interface TemplateExportRecord {
  hospital_name: string;
  department_name: string;
  training_unit_name: string;
  name: string;
  created_by_email: string | null;
  form_family_reference: string;
  template_kind: string;
  target_staff_type: string;
  schema_json: Record<string, unknown>;
}

interface AssignmentExportRecord {
  trainee_email: string;
  template_name: string;
  training_unit_name: string;
  assigned_by_email: string | null;
  renewal_interval_months: number;
  next_due_at: string;
  is_active: boolean;
}

interface RecordExportRecord {
  trainee_email: string;
  template_name: string;
  training_unit_name: string;
  assigned_trainer_email: string | null;
  assignment_template_name: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  trainee_signed_at: string | null;
  expires_at: string;
  status: string;
  assessment_payload_json: Record<string, unknown>;
  specimens: Array<{
    specimenLabel: string;
    specimenType: string | null;
    analyserReference: string | null;
    processedAt: string | null;
    resultSummary: string | null;
  }> | null;
}

export async function exportPrivateSeedSnapshot(db: Pool) {
  const privateUsersResult = await db.query<PrivateSeedUserRecord>(
    `
    SELECT
      u.id,
      h.name AS hospital_name,
      u.name,
      u.email,
      u.password,
      u.role,
      u.staff_type,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT tu.name), NULL) AS training_unit_names
    FROM users u
    INNER JOIN hospitals h ON h.id = u.hospital_id
    LEFT JOIN user_training_units utu ON utu.user_id = u.id
    LEFT JOIN training_units tu ON tu.id = utu.training_unit_id
    WHERE u.email NOT LIKE $1
      AND u.is_active = true
    GROUP BY u.id, h.name, u.name, u.email, u.password, u.role, u.staff_type
    ORDER BY h.name ASC, u.name ASC
    `,
    [`%${demoEmailSuffix}`],
  );

  const privateUsers = privateUsersResult.rows;

  if (privateUsers.length === 0) {
    const emptyPayload = {
      hospitals: [],
      departments: [],
      trainingUnits: [],
      users: [],
      templates: [],
    };

    fs.mkdirSync(path.dirname(privateSeedFilePath), { recursive: true });
    fs.writeFileSync(
      privateSeedFilePath,
      `${JSON.stringify(emptyPayload, null, 2)}\n`,
      "utf8",
    );

    return {
      filePath: privateSeedFilePath,
      exportedUserCount: 0,
      exportedTemplateCount: 0,
    };
  }

  const includedTrainingUnitsResult =
    await db.query<IncludedTrainingUnitRecord>(
      `
    SELECT DISTINCT
      tu.id,
      h.name AS hospital_name,
      l.name AS department_name,
      tu.name,
      l.is_poc
    FROM training_units tu
    INNER JOIN labs l ON l.id = tu.lab_id
    INNER JOIN hospitals h ON h.id = l.hospital_id
    LEFT JOIN user_training_units utu ON utu.training_unit_id = tu.id
    LEFT JOIN users assigned_user
      ON assigned_user.id = utu.user_id
      AND assigned_user.email NOT LIKE $1
      AND assigned_user.is_active = true
    LEFT JOIN templates t ON t.training_unit_id = tu.id
    LEFT JOIN users creator_user
      ON creator_user.id = t.created_by
      AND creator_user.email NOT LIKE $1
      AND creator_user.is_active = true
    WHERE assigned_user.id IS NOT NULL
       OR creator_user.id IS NOT NULL
    ORDER BY h.name ASC, l.name ASC, tu.name ASC
    `,
      [`%${demoEmailSuffix}`],
    );

  const includedTrainingUnits = includedTrainingUnitsResult.rows;
  const includedTrainingUnitIds = includedTrainingUnits.map(
    (trainingUnit) => trainingUnit.id,
  );

  const templateRows =
    includedTrainingUnitIds.length === 0
      ? []
      : (
          await db.query<TemplateExportRecord>(
            `
            SELECT
              h.name AS hospital_name,
              l.name AS department_name,
              tu.name AS training_unit_name,
              t.name,
              creator.email AS created_by_email,
              t.form_family_reference,
              t.template_kind,
              t.target_staff_type,
              latest.schema_json
            FROM templates t
            INNER JOIN training_units tu ON tu.id = t.training_unit_id
            INNER JOIN labs l ON l.id = t.lab_id
            INNER JOIN hospitals h ON h.id = l.hospital_id
            LEFT JOIN users creator ON creator.id = t.created_by
            INNER JOIN LATERAL (
              SELECT tv.schema_json
              FROM template_versions tv
              WHERE tv.template_id = t.id
              ORDER BY tv.version_number DESC
              LIMIT 1
            ) latest ON TRUE
            WHERE t.training_unit_id = ANY($1::int[])
              AND t.is_active = true
            ORDER BY h.name ASC, l.name ASC, tu.name ASC, t.name ASC
            `,
            [includedTrainingUnitIds],
          )
        ).rows;

  const assignmentRows =
    includedTrainingUnitIds.length === 0
      ? []
      : (
          await db.query<AssignmentExportRecord>(
            `
            SELECT
              trainee.email AS trainee_email,
              t.name AS template_name,
              tu.name AS training_unit_name,
              assigner.email AS assigned_by_email,
              ta.renewal_interval_months,
              ta.next_due_at::text,
              ta.is_active
            FROM training_assignments ta
            INNER JOIN users trainee ON trainee.id = ta.user_id
            INNER JOIN templates t ON t.id = ta.template_id
            INNER JOIN training_units tu ON tu.id = ta.training_unit_id
            LEFT JOIN users assigner ON assigner.id = ta.assigned_by
            WHERE ta.training_unit_id = ANY($1::int[])
              AND trainee.email NOT LIKE $2
            ORDER BY trainee.email ASC, tu.name ASC, t.name ASC
            `,
            [includedTrainingUnitIds, `%${demoEmailSuffix}`],
          )
        ).rows;

  const recordRows =
    includedTrainingUnitIds.length === 0
      ? []
      : (
          await db.query<RecordExportRecord>(
            `
            SELECT
              trainee.email AS trainee_email,
              t.name AS template_name,
              tu.name AS training_unit_name,
              trainer.email AS assigned_trainer_email,
              assignment_template.name AS assignment_template_name,
              tr.scheduled_at::text,
              tr.completed_at::text,
              tr.trainee_signed_at::text,
              tr.expires_at::text,
              tr.status,
              tr.assessment_payload_json,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'specimenLabel', trs.specimen_label,
                    'specimenType', trs.specimen_type,
                    'analyserReference', trs.analyser_reference,
                    'processedAt', trs.processed_at,
                    'resultSummary', trs.result_summary
                  )
                  ORDER BY trs.created_at ASC, trs.id ASC
                ) FILTER (WHERE trs.id IS NOT NULL),
                '[]'::json
              ) AS specimens
            FROM training_records tr
            INNER JOIN users trainee ON trainee.id = tr.user_id
            INNER JOIN template_versions tv ON tv.id = tr.template_version_id
            INNER JOIN templates t ON t.id = tv.template_id
            INNER JOIN training_units tu ON tu.id = t.training_unit_id
            LEFT JOIN users trainer ON trainer.id = tr.assigned_trainer_id
            LEFT JOIN training_assignments ta ON ta.id = tr.training_assignment_id
            LEFT JOIN templates assignment_template ON assignment_template.id = ta.template_id
            LEFT JOIN training_record_specimens trs ON trs.training_record_id = tr.id
            WHERE tu.id = ANY($1::int[])
              AND trainee.email NOT LIKE $2
            GROUP BY
              tr.id,
              trainee.email,
              t.name,
              tu.name,
              trainer.email,
              assignment_template.name,
              tr.scheduled_at,
              tr.completed_at,
              tr.trainee_signed_at,
              tr.expires_at,
              tr.status,
              tr.assessment_payload_json
            ORDER BY trainee.email ASC, tu.name ASC, t.name ASC, tr.created_at ASC
            `,
            [includedTrainingUnitIds, `%${demoEmailSuffix}`],
          )
        ).rows;

  const privateAdminByHospital = new Map<string, string>();

  for (const user of privateUsers) {
    if (user.role !== "admin") {
      continue;
    }

    if (!privateAdminByHospital.has(user.hospital_name)) {
      privateAdminByHospital.set(user.hospital_name, user.email);
    }
  }

  const hospitals = [
    ...new Set(privateUsers.map((user) => user.hospital_name)),
  ].map((hospitalName) => ({
    name: hospitalName,
  }));

  const departments = includedTrainingUnits.map((trainingUnit) => ({
    hospitalName: trainingUnit.hospital_name,
    name: trainingUnit.department_name,
    isPoc: trainingUnit.is_poc,
  }));

  const uniqueDepartments = Array.from(
    new Map(
      departments.map((department) => [
        `${department.hospitalName}::${department.name}`,
        department,
      ]),
    ).values(),
  );

  const trainingUnits = includedTrainingUnits.map((trainingUnit) => ({
    hospitalName: trainingUnit.hospital_name,
    departmentName: trainingUnit.department_name,
    name: trainingUnit.name,
    isPoc: trainingUnit.is_poc,
  }));

  const users = privateUsers.map((user) => ({
    hospitalName: user.hospital_name,
    name: user.name,
    email: user.email,
    passwordHash: user.password,
    role: user.role,
    staffType: user.staff_type,
    trainingUnitNames: user.training_unit_names ?? [],
  }));

  const templates = templateRows.map((template) => ({
    hospitalName: template.hospital_name,
    departmentName: template.department_name,
    trainingUnitName: template.training_unit_name,
    name: template.name,
    createdByEmail:
      template.created_by_email &&
      !template.created_by_email.endsWith(demoEmailSuffix)
        ? template.created_by_email
        : (privateAdminByHospital.get(template.hospital_name) ??
          users[0]?.email),
    formFamilyReference: template.form_family_reference,
    templateKind: template.template_kind,
    targetStaffType: template.target_staff_type,
    schemaJson: template.schema_json,
  }));

  const payload = {
    hospitals,
    departments: uniqueDepartments,
    trainingUnits,
    users,
    templates,
    assignments: assignmentRows.map((assignment) => ({
      traineeEmail: assignment.trainee_email,
      templateName: assignment.template_name,
      trainingUnitName: assignment.training_unit_name,
      assignedByEmail: assignment.assigned_by_email ?? users[0]?.email,
      renewalIntervalMonths: assignment.renewal_interval_months,
      nextDueAt: assignment.next_due_at,
      isActive: assignment.is_active,
    })),
    records: recordRows.map((record) => ({
      traineeEmail: record.trainee_email,
      templateName: record.template_name,
      trainingUnitName: record.training_unit_name,
      assignedTrainerEmail: record.assigned_trainer_email,
      trainingAssignmentTemplateName: record.assignment_template_name,
      scheduledAt: record.scheduled_at,
      completedAt: record.completed_at,
      traineeSignedAt: record.trainee_signed_at,
      expiresAt: record.expires_at,
      status: record.status,
      assessmentPayloadJson: record.assessment_payload_json,
      specimens: record.specimens ?? [],
    })),
  };

  fs.mkdirSync(path.dirname(privateSeedFilePath), { recursive: true });
  fs.writeFileSync(
    privateSeedFilePath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  return {
    filePath: privateSeedFilePath,
    exportedUserCount: users.length,
    exportedTemplateCount: templates.length,
  };
}

export async function maybeAutoSyncPrivateSeed(db: Pool) {
  if (!autoSyncPrivateSeed) {
    return;
  }

  try {
    const result = await exportPrivateSeedSnapshot(db);
    console.log(
      `Private seed auto-synced to ${result.filePath} (${result.exportedUserCount} users, ${result.exportedTemplateCount} templates).`,
    );
  } catch (error) {
    console.warn("Private seed auto-sync failed:", error);
  }
}
