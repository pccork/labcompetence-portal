import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  CurrentUser,
} from "../../auth/api";
import {
  HospitalSummary,
  TrainingRecordDetail,
  TrainingAssignmentSummary,
  TrainingRecordSummary,
  UserSummary,
} from "../api";
import { downloadTrainingRecordDocument } from "../../../shared/export/reportExport";
import { confirmManagedAction } from "./managementConfirm";
import { getRoleDisplayLabel } from "./roleLabels";

interface UsersPanelProps {
  currentUser: CurrentUser;
  hospitals: HospitalSummary[];
  users: UserSummary[];
  assignments: TrainingAssignmentSummary[];
  records: TrainingRecordSummary[];
  onFetchRecordDetail: (
    recordId: number
  ) => Promise<{ record: TrainingRecordDetail }>;
  onCreateUser: (input: {
    hospitalId: number;
    name: string;
    email: string;
    password: string;
    role: string;
    staffType: string;
  }) => Promise<void>;
  onArchiveUser: (userId: number) => Promise<void>;
}

const roleOptions = [
  { value: "staff", label: "Staff" },
  { value: "trainer", label: "Trainer" },
  { value: "admin", label: "Local admin / Training coordinator" },
];

const staffTypeOptions = [
  { value: "basic_grade_scientist", label: "Basic Grade Scientist" },
  { value: "senior_medical_scientist", label: "Senior Medical Scientist" },
  { value: "medical_laboratory_aide", label: "Medical Laboratory Aide" },
  { value: "training_coordinator", label: "Training Co-ordinator" },
  { value: "poct_scientist", label: "POCT Scientist" },
  { value: "poct_medical_nursing", label: "POCT Medical/Nursing/Midwifery" },
];

const pocStaffTypes = new Set([
  "poct_scientist",
  "poct_medical_nursing",
]);

const directoryModes = [
  {
    value: "core",
    label: "Core lab staff",
    description: "Scientists, MLAs, trainers, and co-ordinators",
  },
  {
    value: "poc",
    label: "POC users",
    description: "POCT nurses, medics, midwives, and POCT scientists",
  },
] as const;

type DirectoryMode = (typeof directoryModes)[number]["value"];

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

function getDaysUntil(value: string) {
  const deltaMs = new Date(value).getTime() - Date.now();
  return Math.ceil(deltaMs / (1000 * 60 * 60 * 24));
}

function getDueStatus(value: string | null) {
  if (!value) {
    return {
      tone: "normal",
      label: "No due date",
    } as const;
  }

  const daysUntil = getDaysUntil(value);

  if (daysUntil < 0) {
    return {
      tone: "danger",
      label: `Overdue by ${Math.abs(daysUntil)} day${
        Math.abs(daysUntil) === 1 ? "" : "s"
      }`,
    } as const;
  }

  if (daysUntil <= 30) {
    return {
      tone: "danger",
      label: `Due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
    } as const;
  }

  return {
    tone: "normal",
    label: "In date",
  } as const;
}

function getActiveStatus(value: string | null) {
  if (!value) {
    return {
      tone: "muted",
      label: "No active record",
    } as const;
  }

  const daysUntil = getDaysUntil(value);

  if (daysUntil < 0) {
    return {
      tone: "danger",
      label: "Expired",
    } as const;
  }

  if (daysUntil <= 30) {
    return {
      tone: "danger",
      label: `Expires in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
    } as const;
  }

  return {
    tone: "normal",
    label: "Active",
  } as const;
}

function getRecordSummary(record: TrainingRecordSummary | undefined) {
  if (!record) {
    return "No existing record";
  }

  const statusLabel =
    record.status === "signedoff"
      ? "Signed off"
      : record.status === "submitted"
        ? "Submitted"
        : record.status === "expired"
          ? "Expired"
          : "Pending";

  const completedReference = record.completed_at || record.submitted_at;

  return `${statusLabel} · ${formatDate(completedReference)}`;
}

function downloadRecordDocx(detail: TrainingRecordDetail) {
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
        value: detail.trainee_staff_type.replaceAll("_", " "),
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
        value: detail.assigned_trainer_name || "Not assigned",
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
        value: formatDate(detail.trainee_signed_at),
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
        rows: detail.specimens.map((specimen) => [
          specimen.specimen_label,
          specimen.specimen_type || "Not set",
          specimen.analyser_reference || detail.lab_name,
          formatDate(specimen.processed_at),
          specimen.result_summary || "Not set",
        ]),
      },
    ],
    jsonPayload: detail.assessment_payload_json,
  });
}

export function UsersPanel({
  currentUser,
  hospitals,
  users,
  assignments,
  records,
  onFetchRecordDetail,
  onCreateUser,
  onArchiveUser,
}: UsersPanelProps) {
  const [hospitalId, setHospitalId] = useState(() => hospitals[0]?.id || 1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [role, setRole] = useState("staff");
  const [staffType, setStaffType] = useState("basic_grade_scientist");
  const [directoryMode, setDirectoryMode] = useState<DirectoryMode>("core");
  const [staffTypeFilter, setStaffTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecordUserId, setSelectedRecordUserId] = useState<number | null>(
    null
  );
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const firstHospital = hospitals[0];

    if (!firstHospital) {
      return;
    }

    if (!hospitals.some((hospital) => hospital.id === hospitalId)) {
      setHospitalId(firstHospital.id);
    }
  }, [hospitalId, hospitals]);

  const visibleStaffTypeOptions = useMemo(
    () =>
      staffTypeOptions.filter((option) =>
        directoryMode === "poc"
          ? pocStaffTypes.has(option.value)
          : !pocStaffTypes.has(option.value)
      ),
    [directoryMode]
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return users
      .filter((user) =>
        directoryMode === "poc"
          ? pocStaffTypes.has(user.staff_type)
          : !pocStaffTypes.has(user.staff_type)
      )
      .filter((user) =>
        staffTypeFilter === "all"
          ? true
          : user.staff_type === staffTypeFilter
      )
      .filter((user) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        return `${user.name} ${user.email} ${user.hospital_name}`
          .toLowerCase()
          .includes(normalizedSearchTerm);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [directoryMode, searchTerm, staffTypeFilter, users]);

  const canArchiveUsers = currentUser.role === "admin";

  const selectedRecordUser = useMemo(
    () => users.find((user) => user.id === selectedRecordUserId) ?? null,
    [selectedRecordUserId, users]
  );

  const selectedUserAssignments = useMemo(
    () =>
      selectedRecordUserId === null
        ? []
        : assignments.filter((assignment) => assignment.user_id === selectedRecordUserId),
    [assignments, selectedRecordUserId]
  );

  const selectedUserRecords = useMemo(
    () =>
      selectedRecordUserId === null
        ? []
        : records.filter((record) => record.trainee_id === selectedRecordUserId),
    [records, selectedRecordUserId]
  );

  const selectedUserCompetencyRows = useMemo(() => {
    const assignmentMap = new Map<number, TrainingAssignmentSummary>();
    const recordMap = new Map<number, TrainingRecordSummary>();

    selectedUserAssignments.forEach((assignment) => {
      const existing = assignmentMap.get(assignment.template_id);

      if (!existing || assignment.next_due_at < existing.next_due_at) {
        assignmentMap.set(assignment.template_id, assignment);
      }
    });

    selectedUserRecords.forEach((record) => {
      const existing = recordMap.get(record.template_id);

      if (
        !existing ||
        record.expires_at > existing.expires_at ||
        record.created_at > existing.created_at
      ) {
        recordMap.set(record.template_id, record);
      }
    });

    const templateIds = new Set<number>([
      ...assignmentMap.keys(),
      ...recordMap.keys(),
    ]);

    return [...templateIds]
      .map((templateId) => {
        const assignment = assignmentMap.get(templateId);
        const record = recordMap.get(templateId);
        const dueStatus = getDueStatus(assignment?.next_due_at ?? null);
        const activeStatus = getActiveStatus(record?.expires_at ?? null);
        const sectionName = assignment
          ? `${assignment.department_name} / ${assignment.lab_name}`
          : record
            ? `${record.department_name} / ${record.lab_name}`
            : "Not set";

        return {
          templateId,
          templateName: assignment?.template_name || record?.template_name || "Template",
          sectionName,
          dueAt: assignment?.next_due_at ?? null,
          scheduledAt: record?.scheduled_at ?? null,
          existingRecord: getRecordSummary(record),
          recordId: record?.id ?? null,
          activeUntil: record?.expires_at ?? null,
          dueStatus,
          activeStatus,
        };
      })
      .sort((left, right) => {
        const leftRisk =
          (left.dueStatus.tone === "danger" ? 2 : 0) +
          (left.activeStatus.tone === "danger" ? 2 : 0);
        const rightRisk =
          (right.dueStatus.tone === "danger" ? 2 : 0) +
          (right.activeStatus.tone === "danger" ? 2 : 0);

        if (leftRisk !== rightRisk) {
          return rightRisk - leftRisk;
        }

        if (left.dueAt && right.dueAt) {
          return left.dueAt.localeCompare(right.dueAt);
        }

        return left.templateName.localeCompare(right.templateName);
      });
  }, [selectedUserAssignments, selectedUserRecords]);

  useEffect(() => {
    setStaffTypeFilter("all");
  }, [directoryMode]);

  return (
    <section className="columns is-multiline">
      <div className="column is-5-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">People setup</p>
              <h2 className="title is-5">Create a user</h2>
            </div>
            <span className="tag is-info is-light">
              {hospitals.length} hospitals
            </span>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setFormMessage(null);

              const selectedHospital = hospitals.find(
                (hospital) => hospital.id === hospitalId
              );
              const confirmed = confirmManagedAction(
                currentUser,
                `Create user "${name}" in ${
                  selectedHospital?.name || "the selected hospital"
                }?`,
                "Please confirm again to create this user account."
              );

              if (!confirmed) {
                return;
              }

              startTransition(() => {
                void onCreateUser({
                  hospitalId,
                  name,
                  email,
                  password,
                  role,
                  staffType,
                })
                  .then(() => {
                    setName("");
                    setEmail("");
                    setPassword("password123");
                    setRole("staff");
                    setStaffType("basic_grade_scientist");
                    setFormMessage("User created successfully.");
                  })
                  .catch((error) => {
                    setFormMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create user"
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="user-hospital">
                Hospital
              </label>
              <div className="select is-fullwidth">
                <select
                  id="user-hospital"
                  value={hospitalId}
                  onChange={(event) =>
                    setHospitalId(Number(event.target.value))
                  }
                >
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="user-name">
                Full name
              </label>
              <input
                id="user-name"
                className="input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Jack Kenny"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="user-email">
                Email
              </label>
              <input
                id="user-email"
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@hospital.ie"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="user-password">
                Temporary password
              </label>
              <input
                id="user-password"
                className="input"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="user-role">
                Account responsibility
              </label>
              <div className="select is-fullwidth">
                <select
                  id="user-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="user-staff-type">
                Staff type
              </label>
              <div className="select is-fullwidth">
                <select
                  id="user-staff-type"
                  value={staffType}
                  onChange={(event) => setStaffType(event.target.value)}
                >
                  {staffTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formMessage ? (
              <p className="mini-note">{formMessage}</p>
            ) : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending}
            >
              Create user
            </button>
          </form>
        </section>
      </div>

      <div className="column is-7-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Staff directory</p>
              <h2 className="title is-5">
                {directoryMode === "poc"
                  ? "POC users"
                  : "Core lab staff"}
              </h2>
            </div>
            <span className="tag is-success is-light">
              {filteredUsers.length} shown
            </span>
          </div>

          <div className="directory-controls">
            <div className="mode-toggle">
              {directoryModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={`mode-toggle-button ${
                    directoryMode === mode.value ? "is-active" : ""
                  }`}
                  onClick={() => setDirectoryMode(mode.value)}
                >
                  <strong>{mode.label}</strong>
                  <small>{mode.description}</small>
                </button>
              ))}
            </div>

            <div className="columns is-mobile is-variable is-2">
              <div className="column is-7">
                <label className="label" htmlFor="user-search">
                  Search
                </label>
                <input
                  id="user-search"
                  className="input"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, email, hospital"
                />
              </div>

              <div className="column is-5">
                <label className="label" htmlFor="staff-type-filter">
                  Staff type
                </label>
                <div className="select is-fullwidth">
                  <select
                    id="staff-type-filter"
                    value={staffTypeFilter}
                    onChange={(event) =>
                      setStaffTypeFilter(event.target.value)
                    }
                  >
                    <option value="all">All</option>
                    {visibleStaffTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="scroll-list user-list">
            {filteredUsers.length === 0 ? (
              <p className="empty-state">No users returned yet.</p>
            ) : (
              filteredUsers.map((user) => (
                <article className="list-card" key={user.id}>
                  <div>
                    <h3 className="list-title">{user.name}</h3>
                    <p className="list-meta">
                      {user.email} · {user.hospital_name}
                    </p>
                    <p className="mini-note">
                      {user.staff_type.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="tag-stack">
                    <button
                      className="button is-link is-light is-small"
                      type="button"
                      onClick={() => setSelectedRecordUserId(user.id)}
                    >
                      Record
                    </button>
                    {canArchiveUsers &&
                    user.id !== currentUser.id &&
                    user.is_active ? (
                      <button
                        className="button is-danger is-light is-small"
                        type="button"
                        onClick={() => {
                          const confirmed = confirmManagedAction(
                            currentUser,
                            `Archive user "${user.name}"? They will stop appearing in active user lists and will no longer be able to sign in.`,
                            "Please confirm again to archive this user."
                          );

                          if (!confirmed) {
                            return;
                          }

                          startTransition(() => {
                            void onArchiveUser(user.id)
                              .then(() => {
                                setFormMessage(
                                  `${user.name} archived successfully.`
                                );
                              })
                              .catch((error) => {
                                setFormMessage(
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to archive user"
                                );
                              });
                          });
                        }}
                        disabled={isPending}
                      >
                        Archive
                      </button>
                    ) : null}

                    <span
                      className={`tag ${
                        user.role === "admin"
                          ? "is-danger"
                          : user.role === "trainer"
                            ? "is-warning"
                            : "is-link"
                      } is-light`}
                    >
                      {getRoleDisplayLabel(user)}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {selectedRecordUser ? (
        <div
          className="staff-record-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-record-title"
          onClick={() => setSelectedRecordUserId(null)}
        >
          <section
            className="staff-record-modal panel-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading-row">
              <div>
                <p className="panel-kicker">Competency record</p>
                <h2 className="title is-4" id="staff-record-title">
                  {selectedRecordUser.name}
                </h2>
                <p className="list-meta">
                  {selectedRecordUser.email} ·{" "}
                  {selectedRecordUser.staff_type.replaceAll("_", " ")}
                </p>
              </div>

              <button
                className="button is-light"
                type="button"
                onClick={() => setSelectedRecordUserId(null)}
              >
                Close
              </button>
            </div>

            <div className="staff-record-summary">
              <div className="staff-record-summary-card">
                <span>Total competencies</span>
                <strong>{selectedUserCompetencyRows.length}</strong>
              </div>
              <div className="staff-record-summary-card">
                <span>Due / overdue</span>
                <strong>
                  {
                    selectedUserCompetencyRows.filter(
                      (row) => row.dueStatus.tone === "danger"
                    ).length
                  }
                </strong>
              </div>
              <div className="staff-record-summary-card">
                <span>Expired / 30 days</span>
                <strong>
                  {
                    selectedUserCompetencyRows.filter(
                      (row) => row.activeStatus.tone === "danger"
                    ).length
                  }
                </strong>
              </div>
            </div>

            {selectedUserCompetencyRows.length === 0 ? (
              <p className="empty-state">
                No competency assignments or existing records found for this staff member yet.
              </p>
            ) : (
              <div className="staff-record-table-wrap">
                <table className="table is-fullwidth staff-record-table">
                  <thead>
                    <tr>
                      <th>Template</th>
                      <th>Section</th>
                      <th>Due</th>
                      <th>Scheduled</th>
                      <th>Existing</th>
                      <th>Active date</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUserCompetencyRows.map((row) => (
                      <tr key={row.templateId}>
                        <td>
                          <strong>{row.templateName}</strong>
                        </td>
                        <td>{row.sectionName}</td>
                        <td>
                          <div className="staff-record-cell">
                            <span>{formatDate(row.dueAt)}</span>
                            <span
                              className={`staff-record-status is-${row.dueStatus.tone}`}
                            >
                              {row.dueStatus.label}
                            </span>
                          </div>
                        </td>
                        <td>{formatDate(row.scheduledAt)}</td>
                        <td>
                          <div className="staff-record-existing-cell">
                            <span>{row.existingRecord}</span>
                            {row.recordId ? (
                              <button
                                className="button is-small is-light"
                                type="button"
                                onClick={() => {
                                  void onFetchRecordDetail(row.recordId!)
                                    .then(({ record }) => {
                                      downloadRecordDocx(record);
                                    })
                                    .catch((error) => {
                                      window.alert(
                                        error instanceof Error
                                          ? error.message
                                          : "Unable to load printable record"
                                      );
                                    });
                                }}
                              >
                                Download DOCX
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className={
                            row.activeStatus.tone === "danger"
                              ? "staff-record-date-danger"
                              : undefined
                          }
                        >
                          {formatDate(row.activeUntil)}
                        </td>
                        <td>
                          <span
                            className={`staff-record-status is-${row.activeStatus.tone}`}
                          >
                            {row.activeStatus.label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
