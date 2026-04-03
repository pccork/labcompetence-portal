import { TrainingRecordSummary } from "../api";

interface TrainingRecordsPanelProps {
  records: TrainingRecordSummary[];
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TrainingRecordsPanel({
  records,
}: TrainingRecordsPanelProps) {
  return (
    <section className="panel-card">
      <div className="panel-heading-row">
        <div>
          <p className="panel-kicker">Competency records</p>
          <h2 className="title is-5">Recent training records</h2>
        </div>
        <span className="tag is-success is-light">{records.length}</span>
      </div>

      <div className="scroll-list">
        {records.length === 0 ? (
          <p className="empty-state">No training records returned yet.</p>
        ) : (
          records.map((record) => (
            <article className="list-card" key={record.id}>
              <div>
                <h3 className="list-title">{record.template_name}</h3>
                <p className="list-meta">
                  {record.trainee_name} · {record.lab_name} ·{" "}
                  {record.trainee_staff_type.replaceAll("_", " ")}
                </p>
                <p className="mini-note">
                  Scheduled {formatDate(record.scheduled_at)} · completed{" "}
                  {formatDate(record.completed_at)} · expires{" "}
                  {formatDate(record.expires_at)}
                </p>
              </div>

              <span className="tag is-primary is-light">{record.status}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
