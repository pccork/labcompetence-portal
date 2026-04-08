import { useMemo, useState, useTransition } from "react";

import { CurrentUser } from "../../auth/api";
import {
  CreateDepartmentInput,
  DepartmentSummary,
  HospitalSummary,
  LabSummary,
  UserSummary,
} from "../api";
import { confirmManagedAction } from "./managementConfirm";

interface GlobalAdminOverviewPanelProps {
  currentUser: CurrentUser;
  hospitals: HospitalSummary[];
  departments: DepartmentSummary[];
  archivedDepartments: DepartmentSummary[];
  labs: LabSummary[];
  users: UserSummary[];
  onCreateHospital: (input: { name: string }) => Promise<void>;
  onCreateDepartment: (input: CreateDepartmentInput) => Promise<void>;
  onArchiveDepartment: (departmentId: number) => Promise<void>;
  onRestoreDepartment: (departmentId: number) => Promise<void>;
  onDeleteDepartment: (departmentId: number) => Promise<void>;
}

export function GlobalAdminOverviewPanel({
  currentUser,
  hospitals,
  departments,
  archivedDepartments,
  labs,
  users,
  onCreateHospital,
  onCreateDepartment,
  onArchiveDepartment,
  onRestoreDepartment,
  onDeleteDepartment,
}: GlobalAdminOverviewPanelProps) {
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalMessage, setHospitalMessage] = useState<string | null>(null);
  const [departmentHospitalId, setDepartmentHospitalId] = useState(
    () => hospitals[0]?.id || 1
  );
  const [departmentName, setDepartmentName] = useState("");
  const [departmentIsPoc, setDepartmentIsPoc] = useState(false);
  const [departmentMessage, setDepartmentMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hospitalSummaries = useMemo(
    () =>
      hospitals.map((hospital) => {
        const hospitalLabs = labs.filter(
          (lab) => lab.hospital_id === hospital.id
        );
        const hospitalUsers = users.filter(
          (user) => user.hospital_id === hospital.id
        );

        return {
          hospital,
          sectionCount: hospitalLabs.length,
          userCount: hospitalUsers.length,
          adminCount: hospitalUsers.filter((user) => user.role === "admin")
            .length,
        };
      }),
    [hospitals, labs, users]
  );

  return (
    <section className="columns is-multiline">
      <div className="column is-4-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Hospital setup</p>
              <h2 className="title is-5">Create hospital</h2>
            </div>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setHospitalMessage(null);

              const confirmed = confirmManagedAction(
                currentUser,
                `Create hospital "${hospitalName}"?`,
                "Please confirm again to create this hospital."
              );

              if (!confirmed) {
                return;
              }

              startTransition(() => {
                void onCreateHospital({ name: hospitalName })
                  .then(() => {
                    setHospitalName("");
                    setHospitalMessage("Hospital created successfully.");
                  })
                  .catch((error) => {
                    setHospitalMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create hospital"
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="hospital-name">
                Hospital name
              </label>
              <input
                id="hospital-name"
                className="input"
                type="text"
                value={hospitalName}
                onChange={(event) => setHospitalName(event.target.value)}
                placeholder="e.g. CUH"
              />
            </div>

            {hospitalMessage ? (
              <p className="mini-note">{hospitalMessage}</p>
            ) : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending}
            >
              Create hospital
            </button>
          </form>
        </section>
      </div>

      <div className="column is-4-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Department setup</p>
              <h2 className="title is-5">Create department</h2>
            </div>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setDepartmentMessage(null);

              const selectedHospital = hospitals.find(
                (hospital) => hospital.id === departmentHospitalId
              );
              const confirmed = confirmManagedAction(
                currentUser,
                `Create department "${departmentName}" in ${
                  selectedHospital?.name || "the selected hospital"
                }?`,
                "Please confirm again to create this department."
              );

              if (!confirmed) {
                return;
              }

              startTransition(() => {
                void onCreateDepartment({
                  hospitalId: departmentHospitalId,
                  name: departmentName,
                  isPoc: departmentIsPoc,
                })
                  .then(() => {
                    setDepartmentName("");
                    setDepartmentIsPoc(false);
                    setDepartmentMessage("Department created successfully.");
                  })
                  .catch((error) => {
                    setDepartmentMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create department"
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="department-hospital">
                Hospital
              </label>
              <div className="select is-fullwidth">
                <select
                  id="department-hospital"
                  value={departmentHospitalId}
                  onChange={(event) =>
                    setDepartmentHospitalId(Number(event.target.value))
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
              <label className="label" htmlFor="department-name">
                Department name
              </label>
              <input
                id="department-name"
                className="input"
                type="text"
                value={departmentName}
                onChange={(event) => setDepartmentName(event.target.value)}
                placeholder="e.g. Immunology"
              />
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={departmentIsPoc}
                onChange={(event) => setDepartmentIsPoc(event.target.checked)}
              />{" "}
              Point of care department
            </label>

            {departmentMessage ? (
              <p className="mini-note">{departmentMessage}</p>
            ) : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending}
            >
              Create department
            </button>
          </form>
        </section>
      </div>

      <div className="column is-12">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Global summary</p>
              <h2 className="title is-5">Hospital overview bubbles</h2>
            </div>
            <span className="tag is-info is-light">
              {hospitalSummaries.length} hospitals
            </span>
          </div>

          <div className="hospital-bubble-grid">
            {hospitalSummaries.map((summary) => (
              <article className="hospital-bubble" key={summary.hospital.id}>
                <p className="hospital-bubble-kicker">Hospital</p>
                <h3 className="hospital-bubble-title">
                  {summary.hospital.name}
                </h3>
                <div className="hospital-bubble-stats">
                  <div>
                    <strong>{summary.sectionCount}</strong>
                    <span>Sections</span>
                  </div>
                  <div>
                    <strong>{summary.userCount}</strong>
                    <span>Users</span>
                  </div>
                  <div>
                    <strong>{summary.adminCount}</strong>
                    <span>Admin accounts</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="column is-12">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Department registry</p>
              <h2 className="title is-5">Hospital departments</h2>
            </div>
            <span className="tag is-info is-light">
              {departments.length} departments
            </span>
          </div>

          <div className="lab-grid">
            {departments.map((department) => (
              <article className="lab-chip" key={department.id}>
                <strong>{department.name}</strong>
                <small>{department.hospital_name}</small>
                {department.is_poc ? (
                  <span className="tag is-warning is-light">POC</span>
                ) : (
                  <span className="tag is-success is-light">Core lab</span>
                )}
                <div className="buttons mt-2">
                  <button
                    className="button is-small is-warning is-light"
                    type="button"
                    onClick={() => {
                      setDepartmentMessage(null);
                      const confirmed = confirmManagedAction(
                        currentUser,
                        `Archive department "${department.name}"?`,
                        "Please confirm again to archive this department."
                      );

                      if (!confirmed) {
                        return;
                      }

                      startTransition(() => {
                        void onArchiveDepartment(department.id).catch((error) => {
                          setDepartmentMessage(
                            error instanceof Error
                              ? error.message
                              : "Unable to archive department"
                          );
                        });
                      });
                    }}
                  >
                    Archive
                  </button>
                  <button
                    className="button is-small is-danger is-light"
                    type="button"
                    onClick={() => {
                      setDepartmentMessage(null);
                      const confirmed = confirmManagedAction(
                        currentUser,
                        `Delete empty department "${department.name}"?`,
                        "Please confirm again to delete this department."
                      );

                      if (!confirmed) {
                        return;
                      }

                      startTransition(() => {
                        void onDeleteDepartment(department.id).catch((error) => {
                          setDepartmentMessage(
                            error instanceof Error
                              ? error.message
                              : "Unable to delete department"
                          );
                        });
                      });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="column is-12">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Archived departments</p>
              <h2 className="title is-5">Restore department</h2>
            </div>
            <span className="tag is-light">{archivedDepartments.length}</span>
          </div>

          <div className="lab-grid">
            {archivedDepartments.length === 0 ? (
              <p className="empty-state">No archived departments.</p>
            ) : (
              archivedDepartments.map((department) => (
                <article className="lab-chip" key={department.id}>
                  <strong>{department.name}</strong>
                  <small>{department.hospital_name}</small>
                  <span className="tag is-light">archived</span>
                  <div className="buttons mt-2">
                    <button
                      className="button is-small is-link is-light"
                      type="button"
                      onClick={() => {
                        setDepartmentMessage(null);
                        const confirmed = confirmManagedAction(
                          currentUser,
                          `Restore department "${department.name}"?`,
                          "Please confirm again to restore this department."
                        );

                        if (!confirmed) {
                          return;
                        }

                        startTransition(() => {
                          void onRestoreDepartment(department.id).catch((error) => {
                            setDepartmentMessage(
                              error instanceof Error
                                ? error.message
                                : "Unable to restore department"
                            );
                          });
                        });
                      }}
                    >
                      Restore
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
