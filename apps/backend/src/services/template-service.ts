import {
  Pool,
  PoolClient,
} from "pg";
import { StaffType } from "shared-types";

export interface TemplateVersion {
  id: number;
  template_id: number;
  version_number: number;
  schema_json: Record<string, unknown>;
  created_at: Date;
}

export interface TrainingTemplate {
  id: number;
  name: string;
  lab_id: number;
  lab_name: string;
  lab_hospital_id: number;
  lab_hospital_name: string;
  lab_is_poc: boolean;
  created_by: number | null;
  created_by_name: string | null;
  form_family_reference: string;
  template_kind: string;
  target_staff_type: StaffType;
  is_active: boolean;
  created_at: Date;
  latest_version_id: number | null;
  latest_version_number: number | null;
}

export interface TrainingTemplateDetail extends TrainingTemplate {
  versions: TemplateVersion[];
}

export interface TemplateHospitalScope {
  id: number;
  lab_id: number;
  hospital_id: number;
  is_poc: boolean;
}

const templateSummarySelect = `
  SELECT
    t.id,
    t.name,
    t.lab_id,
    l.name AS lab_name,
    l.hospital_id AS lab_hospital_id,
    h.name AS lab_hospital_name,
    l.is_poc AS lab_is_poc,
    t.created_by,
    creator.name AS created_by_name,
    t.form_family_reference,
    t.template_kind,
    t.target_staff_type,
    t.is_active,
    t.created_at,
    latest_version.id AS latest_version_id,
    latest_version.version_number AS latest_version_number
  FROM templates t
  INNER JOIN labs l ON l.id = t.lab_id
  INNER JOIN hospitals h ON h.id = l.hospital_id
  LEFT JOIN users creator ON creator.id = t.created_by
  LEFT JOIN LATERAL (
    SELECT tv.id, tv.version_number
    FROM template_versions tv
    WHERE tv.template_id = t.id
    ORDER BY tv.version_number DESC
    LIMIT 1
  ) latest_version ON true
`;

export async function listTemplates(
  db: Pool,
  hospitalId?: number
) {
  const result = await db.query<TrainingTemplate>(
    `
    ${templateSummarySelect}
    WHERE ($1::int IS NULL OR l.hospital_id = $1)
    ORDER BY h.name ASC, l.name ASC, t.name ASC
    `,
    [hospitalId ?? null]
  );

  return result.rows;
}

export async function findTemplateHospitalScopeById(
  db: Pool,
  templateId: number
) {
  const result = await db.query<TemplateHospitalScope>(
    `
    SELECT
      t.id,
      t.lab_id,
      l.hospital_id,
      l.is_poc
    FROM templates t
    INNER JOIN labs l ON l.id = t.lab_id
    WHERE t.id = $1
    `,
    [templateId]
  );

  return result.rows[0];
}

async function listTemplateVersions(
  db: Pool | PoolClient,
  templateId: number
) {
  const result = await db.query<TemplateVersion>(
    `
    SELECT
      id,
      template_id,
      version_number,
      schema_json,
      created_at
    FROM template_versions
    WHERE template_id = $1
    ORDER BY version_number DESC
    `,
    [templateId]
  );

  return result.rows;
}

export async function findTemplateById(
  db: Pool,
  templateId: number
) {
  const result = await db.query<TrainingTemplate>(
    `
    ${templateSummarySelect}
    WHERE t.id = $1
    `,
    [templateId]
  );

  const template = result.rows[0];

  if (!template) {
    return undefined;
  }

  const versions = await listTemplateVersions(db, templateId);

  return {
    ...template,
    versions,
  } satisfies TrainingTemplateDetail;
}

export async function createTemplateWithInitialVersion(
  db: Pool,
  input: {
    name: string;
    labId: number;
    createdBy: number;
    formFamilyReference: string;
    templateKind: string;
    targetStaffType: StaffType;
    isActive: boolean;
    schemaJson: Record<string, unknown>;
  }
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const templateResult = await client.query<{ id: number }>(
      `
      INSERT INTO templates (
        name,
        lab_id,
        created_by,
        form_family_reference,
        template_kind,
        target_staff_type,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        input.name,
        input.labId,
        input.createdBy,
        input.formFamilyReference,
        input.templateKind,
        input.targetStaffType,
        input.isActive,
      ]
    );

    const templateId = templateResult.rows[0]?.id;

    if (!templateId) {
      throw new Error("Failed to create template");
    }

    await client.query(
      `
      INSERT INTO template_versions (
        template_id,
        version_number,
        schema_json
      )
      VALUES ($1, 1, $2)
      `,
      [templateId, input.schemaJson]
    );

    await client.query("COMMIT");

    const template = await findTemplateById(db, templateId);

    if (!template) {
      throw new Error("Failed to load created template");
    }

    return template;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTemplate(
  db: Pool,
  input: {
    templateId: number;
    name: string;
    labId: number;
    formFamilyReference: string;
    templateKind: string;
    targetStaffType: StaffType;
    isActive: boolean;
  }
) {
  const result = await db.query<{ id: number }>(
    `
    UPDATE templates
    SET
      name = $2,
      lab_id = $3,
      form_family_reference = $4,
      template_kind = $5,
      target_staff_type = $6,
      is_active = $7
    WHERE id = $1
    RETURNING id
    `,
    [
      input.templateId,
      input.name,
      input.labId,
      input.formFamilyReference,
      input.templateKind,
      input.targetStaffType,
      input.isActive,
    ]
  );

  const templateId = result.rows[0]?.id;

  if (!templateId) {
    return undefined;
  }

  return findTemplateById(db, templateId);
}

export async function createTemplateVersion(
  db: Pool,
  templateId: number,
  schemaJson: Record<string, unknown>
) {
  const result = await db.query<{ version_number: number }>(
    `
    INSERT INTO template_versions (
      template_id,
      version_number,
      schema_json
    )
    VALUES (
      $1,
      COALESCE(
        (
          SELECT MAX(version_number) + 1
          FROM template_versions
          WHERE template_id = $1
        ),
        1
      ),
      $2
    )
    RETURNING version_number
    `,
    [templateId, schemaJson]
  );

  if (!result.rows[0]) {
    throw new Error("Failed to create template version");
  }

  const template = await findTemplateById(db, templateId);

  if (!template) {
    throw new Error("Failed to load template after version creation");
  }

  return template;
}
