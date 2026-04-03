import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  CreateTrainingAssignmentInput,
  TemplateSummary,
  TrainingAssignmentSummary,
  UserSummary,
} from "../api";
import { ReportExportActions } from "./ReportExportActions";
import {
  downloadCsvReport,
  printReportTable,
} from "../../../shared/export/reportExport";

interface TrainingAssignmentsPanelProps {
  assignments: TrainingAssignmentSummary[];
  templates: TemplateSummary[];
  users: UserSummary[];
  selectedLabName: string;
  onCreateAssignment: (input: CreateTrainingAssignmentInput) => Promise<void>;
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

function formatForDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDueDateIso(value: string) {
  return new Date(`${value}T09:00:00.000Z`).toISOString();
}

export function TrainingAssignmentsPanel({
  assignments,
  templates,
  users,
  selectedLabName,
  onCreateAssignment,
}: TrainingAssignmentsPanelProps) {
  const trainableUsers = useMemo(
    () =>
      users
        .filter((user) => user.role !== "admin")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [users]
  );

  const activeTemplates = useMemo(
    () =>
      templates
        .filter((template) => template.is_active)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [templates]
  );

  const [userId, setUserId] = useState(() => trainableUsers[0]?.id || 1);
  const [templateId, setTemplateId] = useState(() => activeTemplates[0]?.id || 1);
  const [renewalIntervalMonths, setRenewalIntervalMonths] = useState(12);
  const [nextDueAt, setNextDueAt] = useState(() =>
    formatForDateInput(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedUser = useMemo(
    () => trainableUsers.find((user) => user.id === userId),
    [trainableUsers, userId]
  );

  const compatibleTemplates = useMemo(() => {
    if (!selectedUser) {
      return activeTemplates;
    }

    return activeTemplates.filter(
      (template) =>
        template.target_staff_type === selectedUser.staff_type
    );
  }, [activeTemplates, selectedUser]);

  useEffect(() => {
    const firstUser = trainableUsers[0];

    if (firstUser && !trainableUsers.some((user) => user.id === userId)) {
      setUserId(firstUser.id);
    }
  }, [trainableUsers, userId]);

  useEffect(() => {
    const firstTemplate = compatibleTemplates[0];

    if (
      firstTemplate &&
      !compatibleTemplates.some((template) => template.id === templateId)
    ) {
      setTemplateId(firstTemplate.id);
    }
  }, [compatibleTemplates, templateId]);

  const visibleAssignments = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return [...assignments]
      .filter((assignment) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        return `${assignment.template_name} ${assignment.trainee_name} ${assignment.lab_name} ${assignment.trainee_email}`
          .toLowerCase()
          .includes(normalizedSearchTerm);
      })
      .sort((left, right) =>
        left.next_due_at.localeCompare(right.next_due_at)
      );
  }, [assignments, searchTerm]);

  const assignmentReportRows = useMemo(
    () =>
      visibleAssignments.map((assignment) => [
        assignment.trainee_name,
        assignment.trainee_email,
        assignment.staff_type.replaceAll("_", " "),
        assignment.template_name,
        assignment.lab_name,
        formatDate(assignment.next_due_at),
        assignment.renewal_interval_months,
        getDaysUntil(assignment.next_due_at),
        assignment.assigned_by_name,
      ]),
    [visibleAssignments]
  );

  const assignmentReportColumns = [
    "Trainee",
    "Email",
    "Staff type",
    "Template",
    "Section",
    "Next due date",
    "Renewal months",
    "Days remaining",
    "Assigned by",
  ];

  return (
    <section className="columns is-multiline">
      <div className="column is-5-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Planner</p>
              <h2 className="title is-5">Assign section training</h2>
            </div>
            <span className="tag is-info is-light">
              {compatibleTemplates.length} matching templates
            </span>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setFormMessage(null);

              startTransition(() => {
                void onCreateAssignment({
                  userId,
                  templateId,
                  renewalIntervalMonths,
                  nextDueAt: toDueDateIso(nextDueAt),
                })
                  .then(() => {
                    setFormMessage("Training assignment created.");
                  })
                  .catch((error) => {
                    setFormMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create training assignment"
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="assignment-user">
                User
              </label>
              <div className="select is-fullwidth">
                <select
                  id="assignment-user"
                  value={userId}
                  onChange={(event) => setUserId(Number(event.target.value))}
                >
                  {trainableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.staff_type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="assignment-template">
                Template
              </label>
              <div className="select is-fullwidth">
                <select
                  id="assignment-template"
                  value={templateId}
                  onChange={(event) =>
                    setTemplateId(Number(event.target.value))
                  }
                >
                  {compatibleTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {template.lab_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="columns is-mobile is-variable is-2">
              <div className="column is-5">
                <label className="label" htmlFor="assignment-renewal">
                  Renewal months
                </label>
                <input
                  id="assignment-renewal"
                  className="input"
                  type="number"
                  min="1"
                  value={renewalIntervalMonths}
                  onChange={(event) =>
                    setRenewalIntervalMonths(Number(event.target.value))
                  }
                />
              </div>

              <div className="column is-7">
                <label className="label" htmlFor="assignment-due-date">
                  Next due date
                </label>
                <input
                  id="assignment-due-date"
                  className="input"
                  type="date"
                  value={nextDueAt}
                  onChange={(event) => setNextDueAt(event.target.value)}
                />
              </div>
            </div>

            {selectedUser ? (
              <p className="mini-note">
                Showing templates for {selectedUser.staff_type.replaceAll("_", " ")}.
              </p>
            ) : null}

            {formMessage ? <p className="mini-note">{formMessage}</p> : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending || !compatibleTemplates.length}
            >
              Create assignment
            </button>
          </form>
        </section>
      </div>

      <div className="column is-7-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Trainer queue</p>
              <h2 className="title is-5">Training due soon</h2>
            </div>
            <div className="panel-heading-actions">
              <span className="tag is-warning is-light">
                {visibleAssignments.length} due items
              </span>
              <ReportExportActions
                disabled={!visibleAssignments.length}
                onDownloadCsv={() =>
                  downloadCsvReport(
                    `training-assignments-${selectedLabName
                      .toLowerCase()
                      .replaceAll(/[^a-z0-9]+/g, "-")
                      .replaceAll(/^-|-$/g, "") || "all-sections"}.csv`,
                    assignmentReportColumns,
                    assignmentReportRows
                  )
                }
                onPrint={() =>
                  printReportTable(assignmentReportRows, {
                    columns: assignmentReportColumns,
                    generatedBy: selectedLabName,
                    subtitle: `Current due-training list for ${
                      selectedLabName === "All sections"
                        ? "all lab sections"
                        : selectedLabName
                    }.`,
                    title: "Training due soon",
                  })
                }
              />
            </div>
          </div>

          <p className="list-meta mb-4">
            Filtered to{" "}
            {selectedLabName === "All sections"
              ? "all sections"
              : selectedLabName}
          </p>

          <div className="field">
            <label className="label" htmlFor="assignment-search">
              Search assignments
            </label>
            <input
              id="assignment-search"
              className="input"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search trainee, template, email, or section"
            />
          </div>

          <div className="scroll-list assignment-list">
            {visibleAssignments.length === 0 ? (
              <p className="empty-state">
                No assignment deadlines returned yet.
              </p>
            ) : (
              visibleAssignments.map((assignment) => {
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
                        {assignment.renewal_interval_months} months ·{" "}
                        {assignment.trainee_email}
                      </p>
                    </div>

                    <span
                      className={`tag ${
                        daysLeft <= 30 ? "is-danger" : "is-success"
                      } is-light`}
                    >
                      {daysLeft} days
                    </span>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
