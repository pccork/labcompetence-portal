import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const splitTemplateKinds = ["training_event", "competency_assessment"];
const isDryRun = process.argv.includes("--dry-run");

interface LegacyAssignmentSummary {
  template_kind: string;
  assignment_count: string;
}

async function cleanupLegacyTrainerQueue() {
  const summaryResult = await pool.query<LegacyAssignmentSummary>(
    `
    SELECT
      t.template_kind,
      COUNT(*) AS assignment_count
    FROM training_assignments ta
    INNER JOIN templates t ON t.id = ta.template_id
    WHERE t.template_kind <> ALL($1::text[])
    GROUP BY t.template_kind
    ORDER BY t.template_kind
    `,
    [splitTemplateKinds],
  );

  const totalLegacyAssignments = summaryResult.rows.reduce(
    (total, row) => total + Number(row.assignment_count),
    0,
  );

  if (totalLegacyAssignments === 0) {
    console.log("No legacy trainer queue assignments found.");
    return;
  }

  console.table(
    summaryResult.rows.map((row) => ({
      templateKind: row.template_kind,
      assignments: Number(row.assignment_count),
    })),
  );

  if (isDryRun) {
    console.log(
      `Dry run only. Would delete ${totalLegacyAssignments} legacy trainer queue assignment(s).`,
    );
    return;
  }

  const deleteResult = await pool.query<{ deleted_count: string }>(
    `
    WITH deleted AS (
      DELETE FROM training_assignments ta
      USING templates t
      WHERE t.id = ta.template_id
        AND t.template_kind <> ALL($1::text[])
      RETURNING ta.id
    )
    SELECT COUNT(*) AS deleted_count
    FROM deleted
    `,
    [splitTemplateKinds],
  );

  console.log(
    `Deleted ${Number(
      deleteResult.rows[0]?.deleted_count ?? 0,
    )} legacy trainer queue assignment(s).`,
  );
}

cleanupLegacyTrainerQueue()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
