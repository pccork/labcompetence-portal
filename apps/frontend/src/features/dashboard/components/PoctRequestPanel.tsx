import { useEffect, useMemo, useState, useTransition } from "react";

import { CurrentUser } from "../../auth/api";
import {
  CreatePocRegistrationLinkInput,
  LabSummary,
  PocRegistrationLinkSummary,
  PocTrainingRequestSummary,
  ReplyToPocTrainingRequestInput,
} from "../api";

interface PoctRequestPanelProps {
  currentUser: CurrentUser;
  labs: LabSummary[];
  registrationLinks: PocRegistrationLinkSummary[];
  requests: PocTrainingRequestSummary[];
  onCreateRegistrationLink: (
    input: CreatePocRegistrationLinkInput,
  ) => Promise<void>;
  onReplyToRequest: (
    requestId: number,
    input: ReplyToPocTrainingRequestInput,
  ) => Promise<void>;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildRegistrationUrl(code: string) {
  return `${window.location.origin}/poc/register/${code}`;
}

export function PoctRequestPanel({
  currentUser,
  labs,
  registrationLinks,
  requests,
  onCreateRegistrationLink,
  onReplyToRequest,
}: PoctRequestPanelProps) {
  const poctLabs = useMemo(() => labs.filter((lab) => lab.is_poc), [labs]);
  const [labId, setLabId] = useState<number | "">("");
  const [defaultTrainingLocation, setDefaultTrainingLocation] = useState(
    "A/E reception",
  );
  const [defaultTrainingTimeDetails, setDefaultTrainingTimeDetails] = useState(
    "To be confirmed",
  );
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(
    requests[0]?.id ?? null,
  );
  const [replyStatus, setReplyStatus] = useState<"scheduled" | "cancelled">(
    "scheduled",
  );
  const [trainingLocation, setTrainingLocation] = useState("A/E reception");
  const [trainingTimeDetails, setTrainingTimeDetails] = useState("");
  const [trainerMessage, setTrainerMessage] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLinkCode, setCopiedLinkCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupedRequests = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        requests: PocTrainingRequestSummary[];
      }
    >();

    requests.forEach((request) => {
      const location = request.training_location || "Location not set";
      const key = [
        request.trainee_hospital_name,
        request.lab_name,
        location,
      ].join("::");

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: `${request.trainee_hospital_name} · ${request.lab_name} · ${location}`,
          requests: [],
        });
      }

      groups.get(key)?.requests.push(request);
    });

    return Array.from(groups.values());
  }, [requests]);

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) ?? null;

  useEffect(() => {
    if (selectedRequestId && requests.some((request) => request.id === selectedRequestId)) {
      return;
    }

    const nextRequest = requests[0] ?? null;
    setSelectedRequestId(nextRequest?.id ?? null);
    setTrainingLocation(nextRequest?.training_location || "A/E reception");
    setTrainingTimeDetails(nextRequest?.training_time_details || "");
    setTrainerMessage(nextRequest?.trainer_message || "");
  }, [requests, selectedRequestId]);

  return (
    <section className="columns is-multiline">
      <div className="column is-5-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">POCT registration</p>
              <h2 className="title is-5">Create QR request link</h2>
            </div>
            <span className="tag is-light">{registrationLinks.length} links</span>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              setErrorMessage(null);

              if (!labId) {
                setErrorMessage("Please select a POCT device first.");
                return;
              }

              startTransition(() => {
                void onCreateRegistrationLink({
                  labId,
                  defaultTrainingLocation,
                  defaultTrainingTimeDetails,
                })
                  .then(() => {
                    setMessage("POCT registration link created.");
                    setLabId("");
                  })
                  .catch((error) => {
                    setErrorMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create POCT registration link",
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="poct-link-lab">
                POCT device / pathway
              </label>
              <div className="select is-fullwidth">
                <select
                  id="poct-link-lab"
                  value={labId}
                  onChange={(event) => setLabId(Number(event.target.value))}
                >
                  <option value="">Select a POCT section</option>
                  {poctLabs.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.department_name} / {lab.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="poct-link-location">
                Default location
              </label>
              <input
                id="poct-link-location"
                className="input"
                value={defaultTrainingLocation}
                onChange={(event) =>
                  setDefaultTrainingLocation(event.target.value)
                }
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="poct-link-time">
                Default time notes
              </label>
              <textarea
                id="poct-link-time"
                className="textarea"
                value={defaultTrainingTimeDetails}
                onChange={(event) =>
                  setDefaultTrainingTimeDetails(event.target.value)
                }
                rows={3}
              />
            </div>

            {message ? (
              <div className="notification is-success is-light">{message}</div>
            ) : null}
            {errorMessage ? (
              <div className="notification is-danger is-light">
                {errorMessage}
              </div>
            ) : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending}
            >
              Create registration link
            </button>
          </form>
        </section>
      </div>

      <div className="column is-7-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">POCT request desk</p>
              <h2 className="title is-5">
                {currentUser.name}, schedule grouped requests
              </h2>
            </div>
            <span className="tag is-primary is-light">
              {requests.length} requests
            </span>
          </div>

          <div className="scroll-list poct-scroll-list">
            {groupedRequests.map((group) => (
              <article key={group.key} className="list-card">
                <div>
                  <p className="list-title">{group.label}</p>
                  <p className="mini-note">
                    {group.requests.length} request
                    {group.requests.length === 1 ? "" : "s"} · latest{" "}
                    {formatDateTime(group.requests[0]?.requested_at ?? null)}
                  </p>
                </div>
                <div className="poct-inline-actions">
                  {group.requests.slice(0, 3).map((request) => (
                    <button
                      key={request.id}
                      className={`button is-small ${
                        selectedRequestId === request.id
                          ? "is-link"
                          : "is-light"
                      }`}
                      type="button"
                      onClick={() => {
                        setSelectedRequestId(request.id);
                        setTrainingLocation(
                          request.training_location || "A/E reception",
                        );
                        setTrainingTimeDetails(
                          request.training_time_details || "",
                        );
                        setTrainerMessage(request.trainer_message || "");
                      }}
                    >
                      {request.trainee_name}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Registration URLs</p>
              <h2 className="title is-5">Share or print these QR targets</h2>
            </div>
          </div>

          <div className="scroll-list">
            {registrationLinks.map((link) => {
              const url = buildRegistrationUrl(link.code);

              return (
                <article key={link.code} className="list-card">
                  <div>
                    <p className="list-title">
                      {link.department_name} / {link.lab_name}
                    </p>
                    <p className="mini-note">
                      {link.default_training_location || "Location not set"} ·{" "}
                      {link.default_training_time_details ||
                        "Time details not set"}
                    </p>
                    <p className="list-meta">{url}</p>
                  </div>
                  <div className="poct-inline-actions">
                    <button
                      className="button is-small is-light"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(url).then(() => {
                          setCopiedLinkCode(link.code);
                          window.setTimeout(
                            () => setCopiedLinkCode(null),
                            1800,
                          );
                        });
                      }}
                    >
                      {copiedLinkCode === link.code ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Schedule request</p>
              <h2 className="title is-5">
                {selectedRequest
                  ? `Reply to ${selectedRequest.trainee_name}`
                  : "Select a request to schedule"}
              </h2>
            </div>
          </div>

          {selectedRequest ? (
            <form
              className="stacked-form"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);
                setErrorMessage(null);

                startTransition(() => {
                  void onReplyToRequest(selectedRequest.id, {
                    trainerReplyStatus: replyStatus,
                    trainingLocation,
                    trainingTimeDetails,
                    trainerMessage,
                  })
                    .then(() => {
                      setMessage(
                        `Request ${replyStatus}. The trainee email has been queued.`,
                      );
                    })
                    .catch((error) => {
                      setErrorMessage(
                        error instanceof Error
                          ? error.message
                          : "Unable to update POCT request",
                      );
                    });
                });
              }}
            >
              <div className="poct-request-focus">
                <p className="list-title">{selectedRequest.trainee_name}</p>
                <p className="mini-note">
                  {selectedRequest.trainee_email} ·{" "}
                  {selectedRequest.trainee_hospital_name}
                </p>
                <p className="mini-note">
                  {selectedRequest.lab_name} · requested{" "}
                  {formatDateTime(selectedRequest.requested_at)}
                </p>
              </div>

              <div className="field">
                <label className="label" htmlFor="poct-request-status">
                  Reply status
                </label>
                <div className="select is-fullwidth">
                  <select
                    id="poct-request-status"
                    value={replyStatus}
                    onChange={(event) =>
                      setReplyStatus(
                        event.target.value as "scheduled" | "cancelled",
                      )
                    }
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="poct-request-location">
                  Location
                </label>
                <input
                  id="poct-request-location"
                  className="input"
                  value={trainingLocation}
                  onChange={(event) => setTrainingLocation(event.target.value)}
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="poct-request-time">
                  Date and time details
                </label>
                <textarea
                  id="poct-request-time"
                  className="textarea"
                  rows={3}
                  value={trainingTimeDetails}
                  onChange={(event) =>
                    setTrainingTimeDetails(event.target.value)
                  }
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="poct-request-message">
                  Coordinator message
                </label>
                <textarea
                  id="poct-request-message"
                  className="textarea"
                  rows={4}
                  value={trainerMessage}
                  onChange={(event) => setTrainerMessage(event.target.value)}
                />
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
                className={`button is-link is-fullwidth ${
                  isPending ? "is-loading" : ""
                }`}
                type="submit"
                disabled={isPending}
              >
                Save reply and send email
              </button>
            </form>
          ) : (
            <p className="empty-state">
              New POCT requests will appear here once staff scan a QR link and
              submit their details.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
