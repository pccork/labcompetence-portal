import { useEffect, useMemo, useState, useTransition } from "react";

import { HospitalSummary } from "../dashboard/api";
import {
  fetchPublicHospitals,
  fetchPublicPocRegistrationLink,
  PocRegistrationLinkSummary,
  registerFromPocLink,
} from "../dashboard/api";

interface PocRegistrationPageProps {
  code: string;
}

const staffTypeOptions = [
  {
    label: "POCT Medical / Nursing / Midwifery",
    value: "poct_medical_nursing",
  },
  {
    label: "POCT Scientist",
    value: "poct_scientist",
  },
] as const;

export function PocRegistrationPage({ code }: PocRegistrationPageProps) {
  const [registrationLink, setRegistrationLink] =
    useState<PocRegistrationLinkSummary | null>(null);
  const [hospitals, setHospitals] = useState<HospitalSummary[]>([]);
  const [hospitalId, setHospitalId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [staffType, setStaffType] = useState<string>(
    "poct_medical_nursing",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    void Promise.all([
      fetchPublicPocRegistrationLink(code),
      fetchPublicHospitals(),
    ])
      .then(([linkResponse, hospitalResponse]) => {
        if (!isMounted) {
          return;
        }

        setRegistrationLink(linkResponse.registrationLink);
        setHospitals(hospitalResponse.hospitals);
        setHospitalId(
          hospitalResponse.hospitals[0]?.id ?? linkResponse.registrationLink.hospital_id,
        );
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load registration page",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [code]);

  const selectedHospitalName = useMemo(
    () =>
      hospitals.find((hospital) => hospital.id === hospitalId)?.name ??
      "Select your hospital",
    [hospitalId, hospitals],
  );

  return (
    <section className="hero poc-register-hero is-fullheight">
      <div className="hero-body">
        <div className="container">
          <div className="columns is-centered">
            <div className="column is-10-desktop">
              <div className="poc-register-layout">
                <div className="box poc-register-brief">
                  <p className="eyebrow">POCT request</p>
                  <h1 className="title is-2 mb-3">
                    Request training for {registrationLink?.lab_name ?? "POCT"}
                  </h1>
                  <p className="subtitle is-6 mb-5">
                    Use this form to request a POCT session without waiting for
                    a full account setup. The coordinator will email you with
                    the next available training slot.
                  </p>

                  <div className="poct-register-summary">
                    <article>
                      <span>Device</span>
                      <strong>{registrationLink?.lab_name ?? "Loading..."}</strong>
                    </article>
                    <article>
                      <span>Department</span>
                      <strong>
                        {registrationLink?.department_name ?? "Loading..."}
                      </strong>
                    </article>
                    <article>
                      <span>Default location</span>
                      <strong>
                        {registrationLink?.default_training_location ||
                          "To be confirmed"}
                      </strong>
                    </article>
                  </div>
                </div>

                <div className="box poc-register-form-card">
                  <p className="eyebrow">Quick request</p>
                  <h2 className="title is-4 mb-3">Submit your details</h2>
                  <p className="mini-note mb-4">
                    Hospital selected: {selectedHospitalName}
                  </p>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      setMessage(null);
                      setErrorMessage(null);

                      if (!hospitalId) {
                        setErrorMessage("Please select your hospital.");
                        return;
                      }

                      startTransition(() => {
                        void registerFromPocLink(code, {
                          hospitalId,
                          name: name.trim(),
                          email: email.trim().toLowerCase(),
                          staffType,
                        })
                          .then(() => {
                            setMessage(
                              "Training request submitted. Please check your email for the coordinator reply.",
                            );
                            setName("");
                            setEmail("");
                            setStaffType("poct_medical_nursing");
                          })
                          .catch((error) => {
                            setErrorMessage(
                              error instanceof Error
                                ? error.message
                                : "Unable to submit training request",
                            );
                          });
                      });
                    }}
                  >
                    <div className="field">
                      <label className="label" htmlFor="poc-register-hospital">
                        Your hospital
                      </label>
                      <div className="select is-fullwidth">
                        <select
                          id="poc-register-hospital"
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
                      <label className="label" htmlFor="poc-register-name">
                        Full name
                      </label>
                      <div className="control">
                        <input
                          id="poc-register-name"
                          className="input is-medium"
                          type="text"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="poc-register-email">
                        Work email
                      </label>
                      <div className="control">
                        <input
                          id="poc-register-email"
                          className="input is-medium"
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="poc-register-role">
                        Role / pathway
                      </label>
                      <div className="select is-fullwidth">
                        <select
                          id="poc-register-role"
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

                    {message ? (
                      <div className="notification is-success is-light">
                        {message}
                      </div>
                    ) : null}

                    {errorMessage ? (
                      <div className="notification is-danger is-light">
                        {errorMessage}
                      </div>
                    ) : null}

                    <button
                      className={`button is-link is-medium is-fullwidth ${
                        isPending ? "is-loading" : ""
                      }`}
                      type="submit"
                      disabled={isPending || !registrationLink}
                    >
                      Request POCT training
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
