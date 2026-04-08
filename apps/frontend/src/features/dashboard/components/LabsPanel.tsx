import { useEffect, useState, useTransition } from "react";

import { CurrentUser } from "../../auth/api";
import {
  CreateLabInput,
  DepartmentSummary,
  HospitalSummary,
  LabSummary,
} from "../api";
import { confirmManagedAction } from "./managementConfirm";

interface LabsPanelProps {
  currentUser?: CurrentUser;
  hospitals?: HospitalSummary[];
  departments?: DepartmentSummary[];
  labs: LabSummary[];
  selectedLabId: number | "all";
  onSelectLab: (labId: number | "all") => void;
  onCreateLab?: (input: CreateLabInput) => Promise<void>;
  onArchiveLab?: (labId: number) => Promise<void>;
  onDeleteLab?: (labId: number) => Promise<void>;
  showCreateSection?: boolean;
  showLabSections?: boolean;
}

export function LabsPanel({
  currentUser,
  hospitals = [],
  departments = [],
  labs,
  selectedLabId,
  onSelectLab,
  onCreateLab,
  onArchiveLab,
  onDeleteLab,
  showCreateSection = true,
  showLabSections = true,
}: LabsPanelProps) {
  const [hospitalId, setHospitalId] = useState(() => hospitals[0]?.id || 1);
  const availableDepartments = departments.filter(
    (department) => department.hospital_id === hospitalId
  );
  const defaultDepartmentId = availableDepartments[0]?.id ?? null;
  const [departmentId, setDepartmentId] = useState<number | null>(
    defaultDepartmentId
  );
  const selectedDepartment =
    availableDepartments.find((department) => department.id === departmentId) ??
    null;
  const [sectionName, setSectionName] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canManageSectionsByStaffType =
    currentUser?.staff_type === "training_coordinator" ||
    currentUser?.staff_type === "senior_medical_scientist";
  const canCreateSections =
    showCreateSection &&
    !!currentUser &&
    ((currentUser.role === "admin" && !currentUser.is_global_admin) ||
      canManageSectionsByStaffType) &&
    !!onCreateLab;
  const selectedLab =
    selectedLabId === "all"
      ? null
      : labs.find((lab) => lab.id === selectedLabId) ?? null;

  useEffect(() => {
    setDepartmentId((currentDepartmentId) =>
      availableDepartments.some((department) => department.id === currentDepartmentId)
        ? currentDepartmentId
        : defaultDepartmentId
    );
  }, [defaultDepartmentId, availableDepartments]);

  return (
    <section className="columns is-multiline">
      {canCreateSections ? (
        <div className="column is-4-desktop">
          <section className="panel-card">
            <div className="panel-heading-row">
              <div>
                <p className="panel-kicker">Local setup</p>
                <h2 className="title is-5">Create section</h2>
              </div>
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
                  `Create section "${sectionName}" in ${
                    selectedHospital?.name || "the selected hospital"
                  }?`,
                  "Please confirm again to create this section."
                );

                if (!confirmed) {
                  return;
                }

                startTransition(() => {
                  const createLabInput: CreateLabInput = {
                    hospitalId,
                    name: sectionName,
                    isPoc: selectedDepartment?.is_poc ?? false,
                  };

                  if (selectedDepartment?.id) {
                    createLabInput.departmentId = selectedDepartment.id;
                  }

                  if (selectedDepartment?.name) {
                    createLabInput.departmentName = selectedDepartment.name;
                  }

                  void onCreateLab(createLabInput)
                    .then(() => {
                      setDepartmentId(defaultDepartmentId);
                      setSectionName("");
                      setFormMessage("Section created successfully.");
                    })
                    .catch((error) => {
                      setFormMessage(
                        error instanceof Error
                          ? error.message
                          : "Unable to create section"
                      );
                    });
                });
              }}
            >
              <div className="field">
                <label className="label" htmlFor="local-section-hospital">
                  Hospital
                </label>
                <div className="select is-fullwidth">
                  <select
                    id="local-section-hospital"
                    value={hospitalId}
                    onChange={(event) => setHospitalId(Number(event.target.value))}
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
                <label className="label" htmlFor="local-section-department">
                  Department
                </label>
                {availableDepartments.length === 0 ? (
                  <p className="mini-note">
                    No departments exist for this hospital yet. A global admin
                    needs to create one first.
                  </p>
                ) : (
                  <div className="fixed-grid has-1-cols-mobile has-2-cols-tablet">
                    <div className="grid">
                      {availableDepartments.map((department) => (
                        <label className="radio" key={department.id}>
                          <input
                            type="radio"
                            name="local-section-department"
                            value={department.id}
                            checked={departmentId === department.id}
                            onChange={() => setDepartmentId(department.id)}
                          />{" "}
                          {department.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="field">
                <label className="label" htmlFor="local-section-name">
                  Section / training unit
                </label>
                <input
                  id="local-section-name"
                  className="input"
                  type="text"
                  value={sectionName}
                  onChange={(event) => setSectionName(event.target.value)}
                  placeholder="e.g. Mass Spectrometry"
                />
              </div>

              {selectedDepartment?.is_poc ? (
                <p className="mini-note">
                  Department is fixed to Point of Care for POCT section setup.
                </p>
              ) : (
                <p className="mini-note">
                  Local setup can create sections only under the approved
                  hospital departments.
                </p>
              )}

              {formMessage ? <p className="mini-note">{formMessage}</p> : null}

              <button
                className={`button is-link is-fullwidth ${
                  isPending ? "is-loading" : ""
                }`}
                type="submit"
                disabled={isPending || !selectedDepartment}
              >
                Create section
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {showLabSections ? (
      <div className={canCreateSections ? "column is-8-desktop" : "column is-12"}>
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Lab sections</p>
              <h2 className="title is-5">Section navigator</h2>
            </div>
            <div className="buttons">
              {selectedLab && onArchiveLab ? (
                <button
                  className="button is-small is-warning is-light"
                  type="button"
                  onClick={() => {
                    if (!currentUser) {
                      return;
                    }

                    setFormMessage(null);
                    const confirmed = confirmManagedAction(
                      currentUser,
                      `Archive section "${selectedLab.name}"? This only works after every related template in the section has been archived first.`,
                      "Please confirm again to archive this section. Archive linked templates one by one first; their linked training records will be archived with them."
                    );

                    if (!confirmed) {
                      return;
                    }

                    startTransition(() => {
                      void onArchiveLab(selectedLab.id).catch((error) => {
                        setFormMessage(
                          error instanceof Error
                            ? error.message
                            : "Unable to archive section"
                        );
                      });
                    });
                  }}
                >
                  Archive
                </button>
              ) : null}
              {selectedLab && onDeleteLab ? (
                <button
                  className="button is-small is-danger is-light"
                  type="button"
                  onClick={() => {
                    if (!currentUser) {
                      return;
                    }

                    setFormMessage(null);
                    const confirmed = confirmManagedAction(
                      currentUser,
                      `Delete section "${selectedLab.name}"? This only works when there are no linked templates, assignments, records, or other related data.`,
                      "If linked data exists, delete will be blocked. Archive the linked templates first, then archive the section instead. Please confirm again to continue."
                    );

                    if (!confirmed) {
                      return;
                    }

                    startTransition(() => {
                      void onDeleteLab(selectedLab.id).catch((error) => {
                        setFormMessage(
                          error instanceof Error
                            ? error.message
                            : "Unable to delete section"
                        );
                      });
                    });
                  }}
                >
                  Delete
                </button>
              ) : null}
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
          </div>

          <div className="lab-grid">
            {labs.length === 0 ? (
              <p className="empty-state">No sections returned yet.</p>
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
      </div>
      ) : null}
    </section>
  );
}
