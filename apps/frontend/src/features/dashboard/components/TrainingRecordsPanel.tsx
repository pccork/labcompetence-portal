import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  CreateTrainingRecordInput,
  TrainingRecordDetail,
  TemplateSummary,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
  UserSummary,
} from "../api";
import { CurrentUser } from "../../auth/api";
import { ReportExportActions } from "./ReportExportActions";
import {
  downloadListReportDocx,
  downloadTrainingRecordDocument,
} from "../../../shared/export/reportExport";
import { confirmManagedAction } from "./managementConfirm";
import { getRoleDisplayLabel } from "./roleLabels";

interface TrainingRecordsPanelProps {
  currentUser: CurrentUser;
  assignments: TrainingAssignmentSummary[];
  records: TrainingRecordSummary[];
  templates: TemplateSummary[];
  users: UserSummary[];
  onCreateRecord: (input: CreateTrainingRecordInput) => Promise<void>;
  onFetchRecordDetail: (
    recordId: number
  ) => Promise<{ record: TrainingRecordDetail }>;
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

function formatForDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toOptionalIso(value: string) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T10:00:00.000Z`).toISOString();
}

function toRequiredIso(value: string) {
  return new Date(`${value}T10:00:00.000Z`).toISOString();
}

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "signedoff", label: "Signed off" },
];

export function TrainingRecordsPanel({
  currentUser,
  assignments,
  records,
  templates,
  users,
  onCreateRecord,
  onFetchRecordDetail,
}: TrainingRecordsPanelProps) {
  const sortedUsers = useMemo(
    () =>
      [...users]
        .filter((user) => user.role !== "admin")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [users]
  );

  const trainerUsers = useMemo(
    () =>
      [...users]
        .filter((user) => user.role === "trainer" || user.role === "admin")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [users]
  );

  const [traineeId, setTraineeId] = useState(() => sortedUsers[0]?.id || 1);
  const [assignedTrainerId, setAssignedTrainerId] = useState<number | "none">(
    () => trainerUsers[0]?.id || "none"
  );
  const [trainingAssignmentId, setTrainingAssignmentId] = useState<
    number | "none"
  >(() => assignments[0]?.id || "none");
  const [templateVersionId, setTemplateVersionId] = useState(
    () => templates[0]?.latest_version_id || 1
  );
  const [scheduledAt, setScheduledAt] = useState(() =>
    formatForDateInput(new Date())
  );
  const [completedAt, setCompletedAt] = useState("");
  const [traineeSignedAt, setTraineeSignedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState(() =>
    formatForDateInput(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
  );
  const [status, setStatus] = useState("pending");
  const [specimenOne, setSpecimenOne] = useState("");
  const [specimenTwo, setSpecimenTwo] = useState("");
  const [resultSummary, setResultSummary] = useState("");
  const [assessmentNotes, setAssessmentNotes] = useState(
    JSON.stringify(
      {
        trainerComments: "",
        traineeDeclarationAccepted: false,
        sectionChecklist: [],
      },
      null,
      2
    )
  );
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedAssignment = useMemo(() => {
    if (trainingAssignmentId === "none") {
      return undefined;
    }

    return assignments.find(
      (assignment) => assignment.id === trainingAssignmentId
    );
  }, [assignments, trainingAssignmentId]);

  const selectedTemplate = useMemo(
    () =>
      templates.find((template) =>
        selectedAssignment
          ? template.id === selectedAssignment.template_id
          : (template.latest_version_id || 0) === templateVersionId
      ),
    [selectedAssignment, templateVersionId, templates]
  );

  useEffect(() => {
    const firstUser = sortedUsers[0];

    if (firstUser && !sortedUsers.some((user) => user.id === traineeId)) {
      setTraineeId(firstUser.id);
    }
  }, [sortedUsers, traineeId]);

  useEffect(() => {
    const firstTrainer = trainerUsers[0];

    if (
      assignedTrainerId !== "none" &&
      !trainerUsers.some((trainer) => trainer.id === assignedTrainerId)
    ) {
      setAssignedTrainerId(firstTrainer?.id || "none");
    }
  }, [assignedTrainerId, trainerUsers]);

  useEffect(() => {
    if (!selectedAssignment) {
      const firstTemplate = templates[0];
      if (firstTemplate) {
        setTemplateVersionId(firstTemplate.latest_version_id || 1);
      }
      return;
    }

    setTraineeId(selectedAssignment.user_id);
    setTemplateVersionId(
      templates.find(
        (template) => template.id === selectedAssignment.template_id
      )?.latest_version_id || 1
    );
  }, [selectedAssignment, templates]);

  const recordReportColumns = [
    "Trainee",
    "Email",
    "Staff type",
    "Template",
    "Section",
    "Scheduled date",
    "Completed date",
    "Expires date",
    "Status",
  ];

  const recordReportRows = useMemo(
    () =>
      records.map((record) => [
        record.trainee_name,
        record.trainee_email,
        record.trainee_staff_type.replaceAll("_", " "),
        record.template_name,
        `${record.department_name} / ${record.lab_name}`,
        formatDate(record.scheduled_at),
        formatDate(record.completed_at),
        formatDate(record.expires_at),
        record.status,
      ]),
    [records]
  );

  return (
    <section className="columns is-multiline">
      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Record entry</p>
              <h2 className="title is-5">Create training record</h2>
            </div>
            <span className="tag is-link is-light">
              {templates.length} templates
            </span>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setFormMessage(null);

              let assessmentPayloadJson: Record<string, unknown>;

              try {
                assessmentPayloadJson = JSON.parse(
                  assessmentNotes
                ) as Record<string, unknown>;
              } catch {
                setFormMessage("Assessment JSON is not valid.");
                return;
              }

              const specimens = [specimenOne, specimenTwo]
                .map((value) => value.trim())
                .filter(Boolean)
                .map((specimenLabel) => ({
                  specimenLabel,
                  resultSummary: resultSummary.trim() || null,
                }));

              const confirmed = confirmManagedAction(
                currentUser,
                `Create a training record for "${
                  sortedUsers.find((user) => user.id === traineeId)?.name ||
                  "the selected trainee"
                }" with status "${status}"?`,
                "Please confirm again to create this training record."
              );

              if (!confirmed) {
                return;
              }

              startTransition(() => {
                void onCreateRecord({
                  traineeId,
                  templateVersionId,
                  assignedTrainerId:
                    assignedTrainerId === "none" ? null : assignedTrainerId,
                  trainingAssignmentId:
                    trainingAssignmentId === "none"
                      ? null
                      : trainingAssignmentId,
                  scheduledAt: toOptionalIso(scheduledAt),
                  completedAt: toOptionalIso(completedAt),
                  traineeSignedAt: toOptionalIso(traineeSignedAt),
                  assessmentPayloadJson,
                  specimens,
                  expiresAt: toRequiredIso(expiresAt),
                  status,
                })
                  .then(() => {
                    setSpecimenOne("");
                    setSpecimenTwo("");
                    setResultSummary("");
                    setFormMessage("Training record created.");
                  })
                  .catch((error) => {
                    setFormMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create training record"
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="record-assignment">
                Existing assignment
              </label>
              <div className="select is-fullwidth">
                <select
                  id="record-assignment"
                  value={trainingAssignmentId}
                  onChange={(event) =>
                    setTrainingAssignmentId(
                      event.target.value === "none"
                        ? "none"
                        : Number(event.target.value)
                    )
                  }
                >
                  <option value="none">No linked assignment</option>
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.trainee_name} · {assignment.template_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="record-trainee">
                Trainee
              </label>
              <div className="select is-fullwidth">
                <select
                  id="record-trainee"
                  value={traineeId}
                  onChange={(event) =>
                    setTraineeId(Number(event.target.value))
                  }
                >
                  {sortedUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {user.staff_type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="record-template">
                Template version
              </label>
              <div className="select is-fullwidth">
                <select
                  id="record-template"
                  value={templateVersionId}
                  onChange={(event) =>
                    setTemplateVersionId(Number(event.target.value))
                  }
                  disabled={trainingAssignmentId !== "none"}
                >
                  {templates.map((template) => (
                    <option
                      key={`${template.id}-${
                        template.latest_version_id || "missing"
                      }`}
                      value={template.latest_version_id || 0}
                      disabled={!template.latest_version_id}
                    >
                      {template.name} · v{template.latest_version_number || 1}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTemplate ? (
                <p className="mini-note">
                  {selectedTemplate.department_name} /{" "}
                  {selectedTemplate.lab_name} ·{" "}
                  {selectedTemplate.target_staff_type.replaceAll("_", " ")}
                </p>
              ) : null}
            </div>

            <div className="field">
              <label className="label" htmlFor="record-trainer">
                Trainer / reviewer
              </label>
              <div className="select is-fullwidth">
                <select
                  id="record-trainer"
                  value={assignedTrainerId}
                  onChange={(event) =>
                    setAssignedTrainerId(
                      event.target.value === "none"
                        ? "none"
                        : Number(event.target.value)
                    )
                  }
                >
                  <option value="none">Not assigned</option>
                  {trainerUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} · {getRoleDisplayLabel(user)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="columns is-multiline is-variable is-2 record-field-grid">
              <div className="column is-6-tablet">
                <label className="label" htmlFor="record-scheduled">
                  Scheduled date
                </label>
                <input
                  id="record-scheduled"
                  className="input"
                  type="date"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>

              <div className="column is-6-tablet">
                <label className="label" htmlFor="record-completed">
                  Completed date
                </label>
                <input
                  id="record-completed"
                  className="input"
                  type="date"
                  value={completedAt}
                  onChange={(event) => setCompletedAt(event.target.value)}
                />
              </div>
            </div>

            <div className="columns is-multiline is-variable is-2 record-field-grid">
              <div className="column is-6-tablet">
                <label className="label" htmlFor="record-trainee-signed">
                  Trainee sign date
                </label>
                <input
                  id="record-trainee-signed"
                  className="input"
                  type="date"
                  value={traineeSignedAt}
                  onChange={(event) =>
                    setTraineeSignedAt(event.target.value)
                  }
                />
              </div>

              <div className="column is-6-tablet">
                <label className="label" htmlFor="record-expires">
                  Expires date
                </label>
                <input
                  id="record-expires"
                  className="input"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="record-status">
                Status
              </label>
              <div className="select is-fullwidth">
                <select
                  id="record-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="columns is-multiline is-variable is-2 record-field-grid">
              <div className="column is-6-tablet">
                <label className="label" htmlFor="record-specimen-one">
                  Specimen evidence 1
                </label>
                <input
                  id="record-specimen-one"
                  className="input"
                  type="text"
                  value={specimenOne}
                  onChange={(event) => setSpecimenOne(event.target.value)}
                  placeholder="e.g. LAB12345"
                />
              </div>

              <div className="column is-6-tablet">
                <label className="label" htmlFor="record-specimen-two">
                  Specimen evidence 2
                </label>
                <input
                  id="record-specimen-two"
                  className="input"
                  type="text"
                  value={specimenTwo}
                  onChange={(event) => setSpecimenTwo(event.target.value)}
                  placeholder="e.g. LAB12346"
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="record-summary">
                Evidence note
              </label>
              <input
                id="record-summary"
                className="input"
                type="text"
                value={resultSummary}
                onChange={(event) => setResultSummary(event.target.value)}
                placeholder="Optional short note for both specimens"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="record-assessment-json">
                Assessment JSON
              </label>
              <textarea
                id="record-assessment-json"
                className="textarea template-schema-editor"
                value={assessmentNotes}
                onChange={(event) =>
                  setAssessmentNotes(event.target.value)
                }
                spellCheck="false"
              />
            </div>

            {formMessage ? <p className="mini-note">{formMessage}</p> : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending || !templates.length || !sortedUsers.length}
            >
              Create record
            </button>
          </form>
        </section>
      </div>

      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Competency records</p>
              <h2 className="title is-5">Recent training records</h2>
            </div>
            <div className="panel-heading-actions">
              <span className="tag is-success is-light">
                {records.length}
              </span>
              <ReportExportActions
                disabled={!records.length}
                onDownloadDocx={() =>
                  downloadListReportDocx({
                    filename: "training-records.docx",
                    columns: recordReportColumns,
                    rows: recordReportRows,
                    generatedBy: "Lab Competence Portal",
                    subtitle:
                      "Current list of training records shown in the dashboard.",
                    title: "Training records",
                  })
                }
              />
            </div>
          </div>

          <div className="scroll-list records-list">
            {records.length === 0 ? (
              <p className="empty-state">No training records returned yet.</p>
            ) : (
              records.map((record) => (
                <article className="list-card" key={record.id}>
                  <div>
                    <h3 className="list-title">{record.template_name}</h3>
                    <p className="list-meta">
                      {record.trainee_name} · {record.department_name} /{" "}
                      {record.lab_name} ·{" "}
                      {record.trainee_staff_type.replaceAll("_", " ")}
                    </p>
                    <p className="mini-note">
                      Scheduled {formatDate(record.scheduled_at)} · completed{" "}
                      {formatDate(record.completed_at)} · expires{" "}
                      {formatDate(record.expires_at)}
                    </p>
                  </div>

                  <div className="record-card-actions">
                    <span className="tag is-primary is-light">
                      {record.status}
                    </span>
                    <button
                      className="button is-small is-light"
                      onClick={() => {
                        void onFetchRecordDetail(record.id)
                          .then(({ record: detail }) => {
                            downloadTrainingRecordDocument({
                              filename: `${detail.template_name
                                .toLowerCase()
                                .replaceAll(/[^a-z0-9]+/g, "-")
                                .replaceAll(/^-|-$/g, "") || "training-record"}-${detail.id}.docx`,
                              title: detail.template_name,
                              subtitle: `${detail.form_family_reference} · ${detail.department_name} / ${detail.lab_name} · version ${detail.version_number}`,
                              generatedBy: detail.assigned_trainer_name
                                ? `Trainer: ${detail.assigned_trainer_name}`
                                : "Lab Competence Portal",
                              details: [
                                {
                                  label: "Trainee",
                                  value: detail.trainee_name,
                                },
                                {
                                  label: "Trainee email",
                                  value: detail.trainee_email,
                                },
                                {
                                  label: "Staff type",
                                  value: detail.trainee_staff_type.replaceAll(
                                    "_",
                                    " "
                                  ),
                                },
                                {
                                  label: "Hospital",
                                  value: detail.trainee_hospital_name,
                                },
                                {
                                  label: "Section",
                                  value: `${detail.department_name} / ${detail.lab_name}`,
                                },
                                {
                                  label: "Status",
                                  value: detail.status,
                                },
                                {
                                  label: "Trainer / reviewer",
                                  value:
                                    detail.assigned_trainer_name ||
                                    "Not assigned",
                                },
                                {
                                  label: "Scheduled date",
                                  value: formatDate(detail.scheduled_at),
                                },
                                {
                                  label: "Completed date",
                                  value: formatDate(detail.completed_at),
                                },
                                {
                                  label: "Trainee sign date",
                                  value: formatDate(
                                    detail.trainee_signed_at
                                  ),
                                },
                                {
                                  label: "Submitted date",
                                  value: formatDate(detail.submitted_at),
                                },
                                {
                                  label: "Expires date",
                                  value: formatDate(detail.expires_at),
                                },
                              ],
                              tables: [
                                {
                                  title: "Specimen evidence",
                                  columns: [
                                    "Specimen",
                                    "Type",
                                    "Analyser / section",
                                    "Processed date",
                                    "Result summary",
                                  ],
                                  rows: detail.specimens.map(
                                    (specimen) => [
                                      specimen.specimen_label,
                                      specimen.specimen_type || "Not set",
                                      specimen.analyser_reference ||
                                        detail.lab_name,
                                      formatDate(specimen.processed_at),
                                      specimen.result_summary || "Not set",
                                    ]
                                  ),
                                },
                              ],
                              jsonPayload: detail.assessment_payload_json,
                            });
                          })
                          .catch((error) => {
                            window.alert(
                              error instanceof Error
                                ? error.message
                                : "Unable to load printable record"
                            );
                          });
                      }}
                      type="button"
                    >
                      Download DOCX
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
