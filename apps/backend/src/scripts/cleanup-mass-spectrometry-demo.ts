import dotenv from "dotenv";
import { Pool, PoolClient } from "pg";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const TARGET_SECTION_NAME = "Mass Spectrometry";

async function countRows(
  client: PoolClient,
  queryText: string,
  params: unknown[] = [],
) {
  const result = await client.query<{ count: string }>(queryText, params);
  return Number(result.rows[0]?.count ?? 0);
}

async function cleanupMassSpectrometryDemo() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const matchingLabs = await client.query<{
      id: number;
      name: string;
      hospital_name: string;
    }>(
      `
      SELECT
        l.id,
        l.name,
        h.name AS hospital_name
      FROM labs l
      LEFT JOIN hospitals h ON h.id = l.hospital_id
      WHERE l.name = $1
      ORDER BY l.id ASC
      `,
      [TARGET_SECTION_NAME],
    );

    if (matchingLabs.rowCount === 0) {
      await client.query("ROLLBACK");
      console.log(
        `No "${TARGET_SECTION_NAME}" section was found. Nothing to clean up.`,
      );
      return;
    }

    const labIds = matchingLabs.rows.map((row) => row.id);

    const trainingRecordCount = await countRows(
      client,
      `
      SELECT COUNT(*)::text AS count
      FROM training_records tr
      WHERE tr.template_version_id IN (
        SELECT tv.id
        FROM template_versions tv
        JOIN templates t ON t.id = tv.template_id
        WHERE t.lab_id = ANY($1::int[])
      )
      `,
      [labIds],
    );

    const trainingAssignmentCount = await countRows(
      client,
      `
      SELECT COUNT(*)::text AS count
      FROM training_assignments
      WHERE lab_id = ANY($1::int[])
      `,
      [labIds],
    );

    const userLabCount = await countRows(
      client,
      `
      SELECT COUNT(*)::text AS count
      FROM user_labs
      WHERE lab_id = ANY($1::int[])
      `,
      [labIds],
    );

    const templateCount = await countRows(
      client,
      `
      SELECT COUNT(*)::text AS count
      FROM templates
      WHERE lab_id = ANY($1::int[])
      `,
      [labIds],
    );

    await client.query(
      `
      DELETE FROM training_records
      WHERE template_version_id IN (
        SELECT tv.id
        FROM template_versions tv
        JOIN templates t ON t.id = tv.template_id
        WHERE t.lab_id = ANY($1::int[])
      )
      `,
      [labIds],
    );

    await client.query(
      `
      DELETE FROM training_assignments
      WHERE lab_id = ANY($1::int[])
      `,
      [labIds],
    );

    await client.query(
      `
      DELETE FROM user_labs
      WHERE lab_id = ANY($1::int[])
      `,
      [labIds],
    );

    await client.query(
      `
      DELETE FROM templates
      WHERE lab_id = ANY($1::int[])
      `,
      [labIds],
    );

    const deletedLabs = await client.query<{
      id: number;
      name: string;
      hospital_id: number | null;
    }>(
      `
      DELETE FROM labs
      WHERE id = ANY($1::int[])
      RETURNING id, name, hospital_id
      `,
      [labIds],
    );

    await client.query("COMMIT");

    console.log(`Removed "${TARGET_SECTION_NAME}" demo data.`);
    console.table(
      deletedLabs.rows.map((row) => ({
        labId: row.id,
        section: row.name,
        hospital:
          matchingLabs.rows.find((lab) => lab.id === row.id)?.hospital_name ??
          "Unknown",
      })),
    );
    console.table([
      {
        trainingRecordsDeleted: trainingRecordCount,
        trainingAssignmentsDeleted: trainingAssignmentCount,
        userLabLinksDeleted: userLabCount,
        templatesDeleted: templateCount,
        labsDeleted: deletedLabs.rowCount ?? 0,
      },
    ]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

cleanupMassSpectrometryDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
