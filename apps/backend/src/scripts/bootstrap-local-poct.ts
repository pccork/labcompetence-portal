import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Pool } from "pg";
import { Role, StaffType } from "shared-types";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DEMO_PASSWORD = "password123";
const DUMMY_POCT_COORDINATOR = {
  name: "Demo POCT Coordinator",
  email: "poct.coordinator@test.com",
  role: Role.ADMIN,
  staffType: StaffType.TRAINING_COORDINATOR,
};

function buildPoctBloodGasTemplateSchema(input: {
  title: string;
  targetAudience: string;
  maintenanceTasks: string[];
  references?: string[];
}) {
  return {
    formTitle: "POCT Blood Gas Training and Competency Testing",
    formFamilyReference: "POCT-BLOOD-GAS",
    sectionName: "Blood Gas",
    documentTitle: input.title,
    targetAudience: input.targetAudience,
    sections: [
      {
        type: "overview",
        heading: "General Overview",
        checklistItems: [
          "Acknowledge SOP for Blood Gas Analysis / analyser operation on Q-Pulse and the staff directory.",
          "Aware of ISO 22870, QMS expectations, audit/non-conformances/CAPAs, and support from the POCT operational team.",
          "Identify key analyser components including touchscreen, printer, barcode scanner, reagents, and waste module.",
          "Recognise ready state and when calibration or QC failure prevents patient testing.",
        ],
      },
      {
        type: "pre_analytics",
        heading: "Pre-Analytics",
        checklistItems: [
          "Prepare syringe or capillary sample correctly for analysis.",
          "Describe potential errors caused by incorrect mixing, mislabelling, or delay before analysis.",
        ],
      },
      {
        type: "analysis",
        heading: "Analysis and Data Entry",
        checklistItems: [
          "Analyse a syringe or capillary sample correctly on the blood gas analyser.",
          "Enter password, patient demographics, and retrieve/print results safely.",
          "Maintain confidentiality and secure handling of printed patient results.",
        ],
      },
      {
        type: "post_analytics",
        heading: "Post-Analytical, Clinical Utility and Limitations",
        checklistItems: [
          "Recognise abnormal or critical results and the need for urgent communication.",
          "Understand differences between POCT and central laboratory results for parameters such as potassium and haemoglobin.",
          "Know when confirmatory laboratory analysis is required before treatment or when the result does not fit the clinical picture.",
          "Understand analyser interferences, technical limitations, and common error messages.",
        ],
      },
      {
        type: "maintenance",
        heading: "Maintenance and Safety",
        checklistItems: input.maintenanceTasks,
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
      {
        type: "reference_documents",
        documents: input.references ?? [
          "Blood Gas Analysis SOP",
          "ISO 22870",
          "POCT operational support guidance",
        ],
      },
    ],
  };
}

async function requireId(
  queryText: string,
  params: unknown[],
  label: string,
): Promise<number> {
  const result = await pool.query<{ id: number }>(queryText, params);
  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error(`Unable to resolve ${label}`);
  }

  return id;
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
    ],
  );

  const userId = result.rows[0]?.id;

  if (!userId) {
    throw new Error(`Failed to upsert user ${input.email}`);
  }

  return userId;
}

async function assignUserToTrainingUnit(userId: number, trainingUnitId: number) {
  await pool.query(
    `
    INSERT INTO user_training_units (user_id, training_unit_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, training_unit_id) DO NOTHING
    `,
    [userId, trainingUnitId],
  );
}

async function removeUserFromAllPoctTrainingUnits(userEmail: string) {
  await pool.query(
    `
    DELETE FROM user_training_units utu
    USING users u, training_units tu, labs l
    WHERE utu.user_id = u.id
      AND utu.training_unit_id = tu.id
      AND tu.lab_id = l.id
      AND u.email = $1
      AND l.is_poc = true
    `,
    [userEmail],
  );
}

async function upsertTemplateWithVersion(input: {
  name: string;
  trainingUnitId: number;
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
    [input.trainingUnitId, input.name, input.targetStaffType],
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
            input.trainingUnitId,
            input.createdBy,
            input.formFamilyReference,
            input.templateKind,
            input.targetStaffType,
          ],
        )
      ).rows[0]?.id;

  if (!templateId) {
    throw new Error(`Failed to upsert template ${input.name}`);
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
      input.trainingUnitId,
      input.createdBy,
      input.formFamilyReference,
      input.templateKind,
      input.targetStaffType,
    ],
  );

  await pool.query(
    `
    INSERT INTO template_versions (
      template_id,
      version_number,
      schema_json
    )
    VALUES ($1, 1, $2)
    ON CONFLICT (template_id, version_number) DO UPDATE
    SET schema_json = EXCLUDED.schema_json
    `,
    [templateId, input.schemaJson],
  );
}

async function main() {
  const cuhHospitalId = await requireId(
    `SELECT id FROM hospitals WHERE name = $1 LIMIT 1`,
    ["CUH"],
    "CUH hospital",
  );
  const bloodGasTrainingUnitId = await requireId(
    `SELECT tu.id
     FROM training_units tu
     INNER JOIN labs l ON l.id = tu.lab_id
     INNER JOIN hospitals h ON h.id = l.hospital_id
     WHERE h.name = $1
       AND tu.name = $2
     LIMIT 1`,
    ["CUH", "Blood Gas"],
    "CUH Blood Gas training unit",
  );
  const glucoseMeterTrainingUnitId = await requireId(
    `SELECT tu.id
     FROM training_units tu
     INNER JOIN labs l ON l.id = tu.lab_id
     INNER JOIN hospitals h ON h.id = l.hospital_id
     WHERE h.name = $1
       AND tu.name = $2
     LIMIT 1`,
    ["CUH", "Glucose Meter"],
    "CUH Glucose Meter training unit",
  );

  await removeUserFromAllPoctTrainingUnits("jack.kenny@test.com");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const poctCoordinatorId = await upsertUser({
    hospitalId: cuhHospitalId,
    name: DUMMY_POCT_COORDINATOR.name,
    email: DUMMY_POCT_COORDINATOR.email,
    passwordHash,
    role: DUMMY_POCT_COORDINATOR.role,
    staffType: DUMMY_POCT_COORDINATOR.staffType,
  });

  await pool.query(
    `
    DELETE FROM user_training_units
    WHERE user_id = $1
    `,
    [poctCoordinatorId],
  );

  await assignUserToTrainingUnit(poctCoordinatorId, bloodGasTrainingUnitId);
  await assignUserToTrainingUnit(poctCoordinatorId, glucoseMeterTrainingUnitId);

  await upsertTemplateWithVersion({
    name: "POCT Blood Gas - Scientist Training and Competency",
    trainingUnitId: bloodGasTrainingUnitId,
    createdBy: poctCoordinatorId,
    formFamilyReference: "POCT-BLOOD-GAS",
    templateKind: "poct_training_competency",
    targetStaffType: StaffType.POCT_SCIENTIST,
    schemaJson: buildPoctBloodGasTemplateSchema({
      title:
        "Training and Competency Testing on the Blood Gas Analyser RP500/RL1240: POCT Scientists",
      targetAudience: "POCT Scientists",
      maintenanceTasks: [
        "Perform calibration and QC as applicable for POCT scientist scope.",
        "Change cartridges and waste container and store reagents correctly.",
        "Change sample port and paper roll when required.",
        "Complete cleaning and decontamination procedures safely.",
        "Apply health and safety, infection control, and universal precautions during analyser use.",
      ],
      references: [
        "POCT Blood Gas Scientist Competency Checklist",
        "Blood Gas Analysis SOP",
        "ISO 22870",
      ],
    }),
  });

  await upsertTemplateWithVersion({
    name: "POCT Blood Gas - Medical/Nursing/Midwifery Training and Competency",
    trainingUnitId: bloodGasTrainingUnitId,
    createdBy: poctCoordinatorId,
    formFamilyReference: "POCT-BLOOD-GAS",
    templateKind: "poct_training_competency",
    targetStaffType: StaffType.POCT_MEDICAL_NURSING,
    schemaJson: buildPoctBloodGasTemplateSchema({
      title:
        "Training and Competency Testing on the Blood Gas Analyser: Medical/Nursing/Midwifery Staff",
      targetAudience: "Medical / Nursing / Midwifery Staff",
      maintenanceTasks: [
        "Change cartridges and waste container and understand correct reagent storage.",
        "Change sample port and paper roll when required.",
        "Complete cleaning and decontamination procedures.",
        "Understand health and safety, infection control, and universal precautions.",
        "Understand the implications of password sharing and personal operator accountability.",
      ],
      references: [
        "POCT Blood Gas Medical/Nursing/Midwifery Competency Checklist",
        "Blood Gas Analysis SOP",
        "ISO 22870",
      ],
    }),
  });

  console.log("Jack's POCT scope removed from the local database.");
  console.log(
    `Dummy POCT coordinator ready: ${DUMMY_POCT_COORDINATOR.email} / ${DEMO_PASSWORD}`,
  );
  console.log("POCT Blood Gas templates upserted for local use.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
