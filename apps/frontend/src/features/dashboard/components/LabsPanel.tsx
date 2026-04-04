import { LabSummary } from "../api";

interface LabsPanelProps {
  labs: LabSummary[];
  selectedLabId: number | "all";
  onSelectLab: (labId: number | "all") => void;
}

export function LabsPanel({
  labs,
  selectedLabId,
  onSelectLab,
}: LabsPanelProps) {
  return (
    <section className="panel-card">
      <div className="panel-heading-row">
        <div>
          <p className="panel-kicker">Lab sections</p>
          <h2 className="title is-5">Section navigator</h2>
        </div>
        <button
          className={`button is-small ${
            selectedLabId === "all" ? "is-link" : "is-light"
          }`}
          onClick={() => onSelectLab("all")}
          type="button"
        >
          All
        </button>
      </div>

      <div className="lab-grid">
        {labs.length === 0 ? (
          <p className="empty-state">No labs returned yet.</p>
        ) : (
          labs.map((lab) => (
            <button
              className={`lab-chip ${
                selectedLabId === lab.id ? "is-selected" : ""
              }`}
              key={lab.id}
              onClick={() => onSelectLab(lab.id)}
              type="button"
            >
              <strong>{lab.name}</strong>
              <small>{lab.department_name}</small>
              <small>{lab.hospital_name}</small>
              {lab.is_poc ? (
                <span className="tag is-warning is-light">POC</span>
              ) : (
                <span className="tag is-success is-light">Core lab</span>
              )}
            </button>
          ))
        )}
      </div>
    </section>
  );
}
