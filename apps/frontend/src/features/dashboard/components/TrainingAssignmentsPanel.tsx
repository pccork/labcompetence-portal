import { TrainingAssignmentSummary } from "../api";

interface TrainingAssignmentsPanelProps {
  assignments: TrainingAssignmentSummary[];
  selectedLabName: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDaysUntil(value: string) {
  const deltaMs = new Date(value).getTime() - Date.now();
  return Math.ceil(deltaMs / (1000 * 60 * 60 * 24));
}

export function TrainingAssignmentsPanel({
  assignments,
  selectedLabName,
}: TrainingAssignmentsPanelProps) {
  return (
    <section className="panel-card">
      <div className="panel-heading-row">
        <div>
          <p className="panel-kicker">Trainer queue</p>
          <h2 className="title is-5">Training due soon</h2>
        </div>
        <span className="tag is-warning is-light">
          {assignments.length} due items
        </span>
      </div>

      <p className="list-meta mb-4">
        Filtered to {selectedLabName === "All sections" ? "all sections" : selectedLabName}
      </p>

      <div className="scroll-list">
        {assignments.length === 0 ? (
          <p className="empty-state">No assignment deadlines returned yet.</p>
        ) : (
          assignments.map((assignment) => {
            const daysLeft = getDaysUntil(assignment.next_due_at);

            return (
              <article className="list-card" key={assignment.id}>
                <div>
                  <h3 className="list-title">{assignment.template_name}</h3>
                  <p className="list-meta">
                    {assignment.trainee_name} · {assignment.lab_name} ·{" "}
                    {assignment.staff_type.replaceAll("_", " ")}
                  </p>
                  <p className="mini-note">
                    Due {formatDate(assignment.next_due_at)} · renew every{" "}
                    {assignment.renewal_interval_months} months
                  </p>
                </div>

                <span
                  className={`tag ${daysLeft <= 30 ? "is-danger" : "is-success"} is-light`}
                >
                  {daysLeft} days
                </span>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
