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
  UpdateTrainingAssignmentInput,
  UserSummary,
} from "../api";
import { CurrentUser } from "../../auth/api";
import { ReportExportActions } from "./ReportExportActions";
import { downloadListReportDocx } from "../../../shared/export/reportExport";
import { confirmManagedAction } from "./managementConfirm";

interface TrainingAssignmentsPanelProps {
  currentUser: CurrentUser;
  assignments: TrainingAssignmentSummary[];
  templates: TemplateSummary[];
  users: UserSummary[];
  selectedLabName: string;
  onCreateAssignment: (input: CreateTrainingAssignmentInput) => Promise<void>;
  onUpdateAssignment: (
    assignmentId: number,
    input: UpdateTrainingAssignmentInput
  ) => Promise<void>;
  showPlanner?: boolean;
  showQueue?: boolean;
}

type TemplateKindFilter = "all" | "competency_assessment" | "training_event";

const templateKindFilterOptions: Array<{
  id: TemplateKindFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "competency_assessment", label: "Competency assessment" },
  { id: "training_event", label: "Training event" },
];

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

function getTemplateKindLabel(templateKind: string) {
  if (templateKind === "training_event") {
    return "Training event";
  }

  if (templateKind === "competency_assessment") {
    return "Competency assessment";
  }

  return templateKind.replaceAll("_", " ");
}

function getDefaultRenewalInterval(template?: TemplateSummary) {
  return template?.template_kind === "training_event" ? 0 : 12;
}

function getRenewalLabel(months: number) {
  return months === 0 ? "one-off" : `renew every ${months} months`;
}

function matchesTemplateKindFilter(
  templateKind: string,
  filter: TemplateKindFilter
) {
  return filter === "all" || templateKind === filter;
}

export function TrainingAssignmentsPanel({
  currentUser,
  assignments,
  templates,
  users,
  selectedLabName,
  onCreateAssignment,
  onUpdateAssignment,
  showPlanner = true,
  showQueue = true,
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
  const [plannerTemplateKindFilter, setPlannerTemplateKindFilter] =
    useState<TemplateKindFilter>("all");
  const [queueTemplateKindFilter, setQueueTemplateKindFilter] =
    useState<TemplateKindFilter>("all");
  const [nextDueAt, setNextDueAt] = useState(() =>
    formatForDateInput(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [rescheduleDates, setRescheduleDates] = useState<
    Record<number, string>
  >({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [assignmentActionId, setAssignmentActionId] = useState<number | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const canUpdateAssignments =
    currentUser.role === "admin" || currentUser.role === "trainer";

  const selectedUser = useMemo(
    () => trainableUsers.find((user) => user.id === userId),
    [trainableUsers, userId]
  );

  const compatibleTemplates = useMemo(() => {
    const filteredTemplates = activeTemplates.filter((template) =>
      matchesTemplateKindFilter(
        template.template_kind,
        plannerTemplateKindFilter
      )
    );

    if (!selectedUser) {
      return filteredTemplates;
    }

    return filteredTemplates.filter(
      (template) =>
        template.target_staff_type === selectedUser.staff_type
    );
  }, [activeTemplates, plannerTemplateKindFilter, selectedUser]);

  const selectedTemplate = useMemo(
    () => compatibleTemplates.find((template) => template.id === templateId),
    [compatibleTemplates, templateId]
  );

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
      setRenewalIntervalMonths(getDefaultRenewalInterval(firstTemplate));
    }
  }, [compatibleTemplates, templateId]);

  const visibleAssignments = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return [...assignments]
      .filter((assignment) => {
        if (
          !matchesTemplateKindFilter(
            assignment.template_kind,
            queueTemplateKindFilter
          )
        ) {
          return false;
        }

        if (!normalizedSearchTerm) {
          return true;
        }

        return `${assignment.template_name} ${assignment.trainee_name} ${assignment.department_name} ${assignment.lab_name} ${assignment.trainee_email}`
          .toLowerCase()
          .includes(normalizedSearchTerm);
      })
      .sort((left, right) =>
        left.next_due_at.localeCompare(right.next_due_at)
      );
  }, [assignments, queueTemplateKindFilter, searchTerm]);

  const assignmentReportRows = useMemo(
    () =>
      visibleAssignments.map((assignment) => [
        assignment.trainee_name,
        assignment.trainee_email,
        assignment.staff_type.replaceAll("_", " "),
        assignment.template_name,
        getTemplateKindLabel(assignment.template_kind),
        `${assignment.department_name} / ${assignment.lab_name}`,
        formatDate(assignment.next_due_at),
        getRenewalLabel(assignment.renewal_interval_months),
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
    "Template type",
    "Section",
    "Next due date",
    "Renewal",
    "Days remaining",
    "Assigned by",
  ];

  const renderTemplateKindFilterButtons = (
    value: TemplateKindFilter,
    onChange: (nextValue: TemplateKindFilter) => void,
    label: string
  ) => (
    <div className="field">
      <label className="label">{label}</label>
      <div className="buttons has-addons">
        {templateKindFilterOptions.map((option) => (
          <button
            className={`button is-small ${
              value === option.id ? "is-link" : "is-light"
            }`}
            key={option.id}
            onClick={() => onChange(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const updateAssignment = (
    assignment: TrainingAssignmentSummary,
    input: UpdateTrainingAssignmentInput,
    successMessage: string
  ) => {
    setQueueMessage(null);
    setAssignmentActionId(assignment.id);

    startTransition(() => {
      void onUpdateAssignment(assignment.id, input)
        .then(() => {
          setQueueMessage(successMessage);
        })
        .catch((error) => {
          setQueueMessage(
            error instanceof Error
              ? error.message
              : "Unable to update training assignment"
          );
        })
        .finally(() => {
          setAssignmentActionId(null);
        });
    });
  };

  return (
    <section className="columns is-multiline">
      {showPlanner ? (
      <div
        className={
          showQueue ? "column is-5-desktop" : "column is-12"
        }
      >
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

              const selectedTemplate = compatibleTemplates.find(
                (template) => template.id === templateId
              );
              const confirmed = confirmManagedAction(
                currentUser,
                `Create an assignment for "${
                  selectedUser?.name || "the selected user"
                }" using "${
                  selectedTemplate?.name || "the selected template"
                }"?`,
                "Please confirm again to create this training assignment."
              );

              if (!confirmed) {
                return;
              }

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

            {renderTemplateKindFilterButtons(
              plannerTemplateKindFilter,
              setPlannerTemplateKindFilter,
              "Template type"
            )}

            <div className="field">
              <label className="label" htmlFor="assignment-template">
                Template
              </label>
              <div className="select is-fullwidth">
                <select
                  id="assignment-template"
                  value={templateId}
                  onChange={(event) => {
                    const nextTemplateId = Number(event.target.value);
                    const nextTemplate = compatibleTemplates.find(
                      (template) => template.id === nextTemplateId
                    );

                    setTemplateId(nextTemplateId);
                    setRenewalIntervalMonths(
                      getDefaultRenewalInterval(nextTemplate)
                    );
                  }}
                >
                  {compatibleTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {getTemplateKindLabel(template.template_kind)} ·{" "}
                      {template.department_name} / {template.lab_name}
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
                  min="0"
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
                Showing {plannerTemplateKindFilter === "all"
                  ? "all template types"
                  : getTemplateKindLabel(plannerTemplateKindFilter)} for{" "}
                {selectedUser.staff_type.replaceAll("_", " ")}.
                {selectedTemplate ? (
                  <>
                    {" "}
                    Selected template is {getRenewalLabel(renewalIntervalMonths)}.
                  </>
                ) : null}
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
      ) : null}

      {showQueue ? (
      <div
        className={
          showPlanner ? "column is-7-desktop" : "column is-12"
        }
      >
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
                onDownloadDocx={() =>
                  downloadListReportDocx({
                    filename:
                      `training-assignments-${selectedLabName
                        .toLowerCase()
                        .replaceAll(/[^a-z0-9]+/g, "-")
                        .replaceAll(/^-|-$/g, "") || "all-sections"}.docx`,
                    columns: assignmentReportColumns,
                    rows: assignmentReportRows,
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

          {renderTemplateKindFilterButtons(
            queueTemplateKindFilter,
            setQueueTemplateKindFilter,
            "Queue type"
          )}

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

          {queueMessage ? <p className="mini-note">{queueMessage}</p> : null}

          <div className="scroll-list assignment-list">
            {visibleAssignments.length === 0 ? (
              <p className="empty-state">
                No assignment deadlines returned yet.
              </p>
            ) : (
              visibleAssignments.map((assignment) => {
                const daysLeft = getDaysUntil(assignment.next_due_at);
                const rescheduleDate =
                  rescheduleDates[assignment.id] ||
                  formatForDateInput(new Date(assignment.next_due_at));
                const isActionPending =
                  isPending && assignmentActionId === assignment.id;

                return (
                  <article className="list-card" key={assignment.id}>
                    <div>
                      <h3 className="list-title">{assignment.template_name}</h3>
                      <p className="list-meta">
                        {assignment.trainee_name} ·{" "}
                        {getTemplateKindLabel(assignment.template_kind)} ·{" "}
                        {assignment.department_name} /{" "}
                        {assignment.lab_name} ·{" "}
                        {assignment.staff_type.replaceAll("_", " ")}
                      </p>
                      <p className="mini-note">
                        Due {formatDate(assignment.next_due_at)} ·{" "}
                        {getRenewalLabel(assignment.renewal_interval_months)} ·{" "}
                        {assignment.trainee_email}
                      </p>
                      {canUpdateAssignments ? (
                        <div className="field has-addons mt-3">
                          <p className="control">
                            <input
                              aria-label={`Reschedule ${assignment.template_name}`}
                              className="input is-small"
                              disabled={isActionPending}
                              type="date"
                              value={rescheduleDate}
                              onChange={(event) =>
                                setRescheduleDates((currentDates) => ({
                                  ...currentDates,
                                  [assignment.id]: event.target.value,
                                }))
                              }
                            />
                          </p>
                          <p className="control">
                            <button
                              className={`button is-small is-link ${
                                isActionPending ? "is-loading" : ""
                              }`}
                              disabled={isActionPending || !rescheduleDate}
                              onClick={() => {
                                const confirmed = confirmManagedAction(
                                  currentUser,
                                  `Reschedule "${assignment.template_name}" for ${assignment.trainee_name} to ${formatDate(toDueDateIso(rescheduleDate))}?`,
                                  "Please confirm again to reschedule this training assignment."
                                );

                                if (!confirmed) {
                                  return;
                                }

                                updateAssignment(
                                  assignment,
                                  {
                                    renewalIntervalMonths:
                                      assignment.renewal_interval_months,
                                    nextDueAt: toDueDateIso(rescheduleDate),
                                    isActive: true,
                                  },
                                  "Training assignment rescheduled."
                                );
                              }}
                              type="button"
                            >
                              Reschedule
                            </button>
                          </p>
                          <p className="control">
                            <button
                              className={`button is-small is-danger is-light ${
                                isActionPending ? "is-loading" : ""
                              }`}
                              disabled={isActionPending}
                              onClick={() => {
                                const confirmed = confirmManagedAction(
                                  currentUser,
                                  `Delete "${assignment.template_name}" from ${assignment.trainee_name}'s queue?`,
                                  "Please confirm again to remove this scheduled assignment."
                                );

                                if (!confirmed) {
                                  return;
                                }

                                updateAssignment(
                                  assignment,
                                  {
                                    renewalIntervalMonths:
                                      assignment.renewal_interval_months,
                                    nextDueAt: assignment.next_due_at,
                                    isActive: false,
                                  },
                                  "Training assignment removed from the queue."
                                );
                              }}
                              type="button"
                            >
                              Delete
                            </button>
                          </p>
                        </div>
                      ) : null}
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
      ) : null}
    </section>
  );
}
