import { useMemo, useState, useTransition } from "react";

import { CurrentUser } from "../../auth/api";
import {
  HospitalSummary,
  LabSummary,
  UserSummary,
} from "../api";
import { confirmManagedAction } from "./managementConfirm";

interface GlobalAdminOverviewPanelProps {
  currentUser: CurrentUser;
  hospitals: HospitalSummary[];
  labs: LabSummary[];
  users: UserSummary[];
  onCreateHospital: (input: { name: string }) => Promise<void>;
}

export function GlobalAdminOverviewPanel({
  currentUser,
  hospitals,
  labs,
  users,
  onCreateHospital,
}: GlobalAdminOverviewPanelProps) {
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalMessage, setHospitalMessage] = useState<string | null>(null);
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
    </section>
  );
}
