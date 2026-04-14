import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import dotenv from "dotenv";
import { Pool, PoolClient } from "pg";
import { StaffType } from "shared-types";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const formFamilyReference = "FOR-CUH-PAT-2";
const repoRoot = path.resolve(__dirname, "../../../..");
const samplesRoot = path.resolve(__dirname, "../../template-samples");
const trainingEventRoot = path.join(samplesRoot, "training-event");
const competencyAssessmentRoot = path.join(
  samplesRoot,
  "competency-assessment",
);

type TemplateKind = "training_event" | "competency_assessment";

interface SampleTemplate {
  kind: TemplateKind;
  sourceFileName: string;
  sourceRelativePath: string;
  sourceFullPath: string;
  canonicalKey: string;
  displayName: string;
  code: string;
  versionNumber: number | null;
  targetStaffType: StaffType;
  sourceText: string;
}

interface SeededTemplate {
  templateId: number;
  templateVersionId: number;
}

type Queryable = Pick<Pool | PoolClient, "query">;

const displayNameOverrides = new Map<string, string>([
  ["AU5800", "AU5800"],
  ["AUTOMATE", "Automate"],
  ["CONTINGENCY", "Contingency"],
  ["DOCUMENT CONTROLLER", "Document Controller"],
  ["DXA 5000", "DXA 5000"],
  ["DYNAMIC FUNCTION TESTS", "Dynamic Function Tests"],
  ["ENDOCRINOLOGY DXI800", "Endocrinology DXI800"],
  ["ENDOCRINOLOGY DXI9000", "Endocrinology DXI9000"],
  ["FCAL MEDICAL SCIENTIST", "Faecal Calprotectin Medical Scientist"],
  ["FCAL MLA", "Faecal Calprotectin MLA"],
  ["HAEMATINICS", "Haematinics"],
  ["IDS I10", "IDS-i10"],
  ["LIS MEDICAL SCIENTIST", "LIS Medical Scientist"],
  ["LIS MLA", "LIS MLA"],
  ["ONCALL", "On Call"],
  ["SENIOR MEDICAL SCIENTIST", "Senior Medical Scientist"],
  [
    "SENIOR MEDICAL SCIENTIST FLEX SCOPE",
    "Senior Medical Scientist Flexible Scope",
  ],
  ["SPECIMEN RECEPTION", "Specimen Reception"],
  ["SPECIMEN RECEPTION ICM", "Specimen Reception ICM"],
  ["SPECIMEN RECEPTION REFERRALS", "Specimen Reception Referrals"],
  ["URINE MEDICAL SCIENTIST", "Urine Medical Scientist"],
  ["URINE MLA", "Urine MLA"],
  ["AUTHORISATION OF RESULTS", "Authorisation of Results"],
]);

function normaliseSampleKey(value: string) {
  return value
    .replace(/(\.docx|\.doc)+$/i, "")
    .replace(/\s+-V\d+$/i, "")
    .replace(/-V\d+$/i, "")
    .replace(/^FOR-CUH-PAT-2\s+/i, "")
    .replace(/^(TE|CA)-/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function formatDisplayName(canonicalKey: string) {
  const override = displayNameOverrides.get(canonicalKey);

  if (override) {
    return override;
  }

  return canonicalKey
    .toLowerCase()
    .split(" ")
    .map((word) =>
      ["dxa", "ids", "lis", "mla", "fcal", "icm"].includes(word)
        ? word.toUpperCase()
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(" ");
}

function getVersionNumber(fileName: string) {
  const match = fileName.match(/(?:\s|-)?V(\d+)(?:\.docx|\.doc)+$/i);
  return match ? Number(match[1]) : null;
}

function getTargetStaffType(canonicalKey: string) {
  if (canonicalKey.includes("MLA")) {
    return StaffType.MEDICAL_LABORATORY_AIDE;
  }

  if (canonicalKey.includes("SENIOR MEDICAL SCIENTIST")) {
    return StaffType.SENIOR_MEDICAL_SCIENTIST;
  }

  if (canonicalKey.includes("DOCUMENT CONTROLLER")) {
    return StaffType.TRAINING_COORDINATOR;
  }

  return StaffType.BASIC_GRADE_SCIENTIST;
}

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function readDocxText(filePath: string) {
  try {
    const documentXml = execFileSync(
      "unzip",
      ["-p", filePath, "word/document.xml"],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );

    return decodeXmlText(
      documentXml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:br\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    );
  } catch {
    return "";
  }
}

function listSamples(folderPath: string, kind: TemplateKind) {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Missing template sample folder: ${folderPath}`);
  }

  const latestByKey = new Map<string, SampleTemplate>();

  for (const sourceFileName of fs.readdirSync(folderPath).sort()) {
    if (!/\.docx?$/i.test(sourceFileName)) {
      continue;
    }

    const sourceFullPath = path.join(folderPath, sourceFileName);
    const sourceRelativePath = path.relative(repoRoot, sourceFullPath);
    const canonicalKey = normaliseSampleKey(sourceFileName);
    const versionNumber = getVersionNumber(sourceFileName);
    const sample: SampleTemplate = {
      kind,
      sourceFileName,
      sourceRelativePath,
      sourceFullPath,
      canonicalKey,
      displayName: formatDisplayName(canonicalKey),
      code: `${kind === "training_event" ? "TE" : "CA"}/${formatDisplayName(
        canonicalKey,
      )}`,
      versionNumber,
      targetStaffType: getTargetStaffType(canonicalKey),
      sourceText: readDocxText(sourceFullPath),
    };

    const existing = latestByKey.get(canonicalKey);
    const existingVersion = existing?.versionNumber ?? 0;
    const sampleVersion = sample.versionNumber ?? 0;

    if (!existing || sampleVersion >= existingVersion) {
      latestByKey.set(canonicalKey, sample);
    }
  }

  return [...latestByKey.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

async function upsertHospital(name: string) {
  const result = await pool.query<{ id: number }>(
    `
    INSERT INTO hospitals (name)
    VALUES ($1)
    ON CONFLICT (name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id
    `,
    [name],
  );

  return result.rows[0]!.id;
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
    [input.hospitalId, input.name, input.isPoc],
  );

  return result.rows[0]!.id;
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
    [input.departmentId, input.name],
  );

  return result.rows[0]!.id;
}

async function findTemplateCreatorId() {
  const result = await pool.query<{ id: number }>(
    `
    SELECT id
    FROM users
    WHERE role = 'admin'
    ORDER BY
      CASE WHEN staff_type = 'training_coordinator' THEN 0 ELSE 1 END,
      id ASC
    LIMIT 1
    `,
  );

  const userId = result.rows[0]?.id;

  if (!userId) {
    throw new Error(
      "No admin user exists to own the imported templates. Run the normal seed first, or create an admin/training coordinator account.",
    );
  }

  return userId;
}

async function resetTemplateTables(db: Queryable) {
  await db.query("DELETE FROM acknowledgements");
  await db.query("DELETE FROM training_record_specimens");
  await db.query("DELETE FROM training_records");
  await db.query("DELETE FROM training_assignments");
  await db.query("DELETE FROM template_versions");
  await db.query("DELETE FROM templates");
}

function buildTrainingEventSchema(sample: SampleTemplate) {
  return {
    formTitle: "Training Event Form",
    formFamilyReference,
    sectionName: sample.displayName,
    documentTitle: `${formFamilyReference} ${sample.displayName} Training Event`,
    sourceDocument: {
      fileName: sample.sourceFileName,
      relativePath: sample.sourceRelativePath,
      versionNumber: sample.versionNumber,
    },
    sourceDocumentText: sample.sourceText,
    sections: [
      {
        type: "training_event",
        code: sample.code,
        description:
          "Initial training event for staff starting this section or duty. Use the source document text as the controlled training-event content.",
        objectives: [
          "Read and understand the current controlled procedure and supporting documents.",
          "Complete supervised training for the section tasks before independent practice.",
          "Record trainer and trainee signoff when initial training is complete.",
        ],
        referenceDocuments: [sample.sourceFileName],
      },
      {
        type: "source_document_text",
        heading: "Uploaded Training Event Document Text",
        text: sample.sourceText,
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

function buildCompetencyAssessmentSchema(
  sample: SampleTemplate,
  relatedTrainingEvent: SampleTemplate | undefined,
) {
  return {
    formTitle: "Competency Assessment Form",
    formFamilyReference,
    sectionName: sample.displayName,
    documentTitle: `${formFamilyReference} ${sample.displayName} Competency Assessment`,
    renewalIntervalMonths: 12,
    relatedTrainingEvent: relatedTrainingEvent
      ? {
          code: relatedTrainingEvent.code,
          sourceDocument: relatedTrainingEvent.sourceRelativePath,
          templateName: `${formFamilyReference} ${relatedTrainingEvent.displayName} Training Event`,
        }
      : null,
    sourceDocument: {
      fileName: sample.sourceFileName,
      relativePath: sample.sourceRelativePath,
      versionNumber: sample.versionNumber,
    },
    sourceDocumentText: sample.sourceText,
    sections: [
      {
        type: "competency_assessment",
        code: sample.code,
        description:
          "Annual competency assessment for staff after the initial training event has been completed.",
        objectives: [
          "Confirm continuing competence for this section or duty.",
          "Review evidence, observation, questions, and records required by the controlled competency document.",
          "Repeat this competency assessment annually unless local policy states otherwise.",
        ],
        tasks: [
          {
            taskLabel: "Annual competency assessment completed",
            method: "DOWP/RR",
          },
        ],
        referenceDocuments: [
          sample.sourceFileName,
          ...(relatedTrainingEvent
            ? [relatedTrainingEvent.sourceFileName]
            : []),
        ],
      },
      {
        type: "source_document_text",
        heading: "Uploaded Competency Assessment Document Text",
        text: sample.sourceText,
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

async function createTemplateWithVersion(
  db: Queryable,
  input: {
    name: string;
    trainingUnitId: number;
    createdBy: number;
    templateKind: TemplateKind;
    targetStaffType: StaffType;
    schemaJson: Record<string, unknown>;
  },
) {
  const templateResult = await db.query<{ id: number }>(
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
      formFamilyReference,
      input.templateKind,
      input.targetStaffType,
    ],
  );

  const templateId = templateResult.rows[0]!.id;
  const versionResult = await db.query<{ id: number }>(
    `
    INSERT INTO template_versions (
      template_id,
      version_number,
      schema_json
    )
    VALUES ($1, 1, $2)
    RETURNING id
    `,
    [templateId, input.schemaJson],
  );

  return {
    templateId,
    templateVersionId: versionResult.rows[0]!.id,
  } satisfies SeededTemplate;
}

async function resetTemplatesFromSamples() {
  const trainingEvents = listSamples(trainingEventRoot, "training_event");
  const competencyAssessments = listSamples(
    competencyAssessmentRoot,
    "competency_assessment",
  );
  const trainingEventByKey = new Map(
    trainingEvents.map((sample) => [sample.canonicalKey, sample]),
  );
  const allCanonicalSamples = new Map<string, SampleTemplate>();

  for (const sample of [...trainingEvents, ...competencyAssessments]) {
    allCanonicalSamples.set(sample.canonicalKey, sample);
  }

  if (process.argv.includes("--dry-run")) {
    const trainingEventByKey = new Set(
      trainingEvents.map((sample) => sample.canonicalKey),
    );
    const unmatchedCompetencies = competencyAssessments.filter(
      (sample) => !trainingEventByKey.has(sample.canonicalKey),
    );

    console.log(
      `Would reset templates from samples: ${trainingEvents.length} training events, ${competencyAssessments.length} competency assessments.`,
    );

    if (unmatchedCompetencies.length > 0) {
      console.log(
        `Competency assessments without matching training event: ${unmatchedCompetencies
          .map((sample) => sample.displayName)
          .join(", ")}.`,
      );
    }

    return;
  }

  const creatorId = await findTemplateCreatorId();
  const hospitalId = await upsertHospital("CUH");
  const departmentId = await upsertDepartment({
    hospitalId,
    name: "Biochemistry",
    isPoc: false,
  });

  const trainingUnitIds = new Map<string, number>();

  for (const sample of [...allCanonicalSamples.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  )) {
    trainingUnitIds.set(
      sample.canonicalKey,
      await upsertTrainingUnit({
        departmentId,
        name: sample.displayName,
      }),
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await resetTemplateTables(client);

    for (const sample of trainingEvents) {
      const trainingUnitId = trainingUnitIds.get(sample.canonicalKey);

      if (!trainingUnitId) {
        throw new Error(`Missing training unit for ${sample.displayName}`);
      }

      await createTemplateWithVersion(client, {
        name: `${formFamilyReference} ${sample.displayName} Training Event`,
        trainingUnitId,
        createdBy: creatorId,
        templateKind: "training_event",
        targetStaffType: sample.targetStaffType,
        schemaJson: buildTrainingEventSchema(sample),
      });
    }

    for (const sample of competencyAssessments) {
      const trainingUnitId = trainingUnitIds.get(sample.canonicalKey);

      if (!trainingUnitId) {
        throw new Error(`Missing training unit for ${sample.displayName}`);
      }

      await createTemplateWithVersion(client, {
        name: `${formFamilyReference} ${sample.displayName} Competency Assessment`,
        trainingUnitId,
        createdBy: creatorId,
        templateKind: "competency_assessment",
        targetStaffType: sample.targetStaffType,
        schemaJson: buildCompetencyAssessmentSchema(
          sample,
          trainingEventByKey.get(sample.canonicalKey),
        ),
      });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const competencyAssessmentsWithoutTrainingEvent = competencyAssessments
    .filter((sample) => !trainingEventByKey.has(sample.canonicalKey))
    .map((sample) => sample.displayName);

  console.log(
    `Reset templates from samples: ${trainingEvents.length} training events, ${competencyAssessments.length} competency assessments.`,
  );

  if (competencyAssessmentsWithoutTrainingEvent.length > 0) {
    console.log(
      `Competency assessments without matching training event: ${competencyAssessmentsWithoutTrainingEvent.join(
        ", ",
      )}.`,
    );
  }
}

resetTemplatesFromSamples()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
