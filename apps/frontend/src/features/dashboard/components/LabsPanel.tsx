import { useEffect, useState, useTransition } from "react";

import { CurrentUser } from "../../auth/api";
import {
  CreateLabInput,
  HospitalSummary,
  LabSummary,
} from "../api";
import { confirmManagedAction } from "./managementConfirm";

const DEFAULT_CORE_DEPARTMENTS = [
  "Biochemistry",
  "Microbiology",
  "Virology",
  "Haematology",
  "Histology",
] as const;

const POINT_OF_CARE_DEPARTMENT = "Point of Care";

interface LabsPanelProps {
  currentUser?: CurrentUser;
  hospitals?: HospitalSummary[];
  labs: LabSummary[];
  selectedLabId: number | "all";
  onSelectLab: (labId: number | "all") => void;
  onCreateLab?: (input: CreateLabInput) => Promise<void>;
  showCreateSection?: boolean;
  showLabSections?: boolean;
}

export function LabsPanel({
  currentUser,
  hospitals = [],
  labs,
  selectedLabId,
  onSelectLab,
  onCreateLab,
  showCreateSection = true,
  showLabSections = true,
}: LabsPanelProps) {
  const hasPoctOnlyScope = labs.length > 0 && labs.every((lab) => lab.is_poc);
  const departmentOptions = hasPoctOnlyScope
    ? [POINT_OF_CARE_DEPARTMENT]
    : [...DEFAULT_CORE_DEPARTMENTS];
  const defaultDepartmentName = departmentOptions[0] ?? "";
  const defaultIsPoc = defaultDepartmentName === POINT_OF_CARE_DEPARTMENT;
  const [hospitalId, setHospitalId] = useState(() => hospitals[0]?.id || 1);
  const [departmentName, setDepartmentName] = useState(defaultDepartmentName);
  const [sectionName, setSectionName] = useState("");
  const [isPoc, setIsPoc] = useState(defaultIsPoc);
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

  useEffect(() => {
    const allowedDepartmentOptions = hasPoctOnlyScope
      ? [POINT_OF_CARE_DEPARTMENT]
      : [...DEFAULT_CORE_DEPARTMENTS];

    setDepartmentName((currentDepartmentName: string) =>
      allowedDepartmentOptions.includes(
        currentDepartmentName as (typeof allowedDepartmentOptions)[number]
      )
        ? currentDepartmentName
        : defaultDepartmentName
    );
    setIsPoc(defaultIsPoc);
  }, [defaultDepartmentName, defaultIsPoc, hasPoctOnlyScope]);

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
                  void onCreateLab({
                    hospitalId,
                    departmentName: departmentName.trim() || defaultDepartmentName,
                    name: sectionName,
                    isPoc: defaultIsPoc || isPoc,
                  })
                    .then(() => {
                      setDepartmentName(defaultDepartmentName);
                      setSectionName("");
                      setIsPoc(defaultIsPoc);
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
                {defaultIsPoc ? (
                  <input
                    id="local-section-department"
                    className="input"
                    type="text"
                    value={POINT_OF_CARE_DEPARTMENT}
                    readOnly
                  />
                ) : (
                  <div className="fixed-grid has-1-cols-mobile has-2-cols-tablet">
                    <div className="grid">
                      {departmentOptions.map((departmentOption) => (
                        <label className="radio" key={departmentOption}>
                          <input
                            type="radio"
                            name="local-section-department"
                            value={departmentOption}
                            checked={departmentName === departmentOption}
                            onChange={(event) =>
                              setDepartmentName(event.target.value)
                            }
                          />{" "}
                          {departmentOption}
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

              {defaultIsPoc ? (
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
                disabled={isPending}
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
