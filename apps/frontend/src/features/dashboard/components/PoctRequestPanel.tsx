import QRCode from "qrcode";
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
  onDeleteRegistrationLink: (code: string) => Promise<void>;
  onUpdateRegistrationLinkStatus: (
    code: string,
    isActive: boolean,
  ) => Promise<void>;
  onReplyToRequest: (
    requestId: number,
    input: ReplyToPocTrainingRequestInput,
  ) => Promise<void>;
}

interface RequestGroup {
  deviceName: string;
  hospitalName: string;
  key: string;
  latestRequestedAt: string;
  locationName: string;
  requests: PocTrainingRequestSummary[];
  status: string;
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

function buildGroupKey(request: PocTrainingRequestSummary) {
  return [
    request.trainee_hospital_name,
    request.lab_name,
    request.training_location || "Location not set",
    request.trainer_reply_status,
  ].join("::");
}

function escapePrintHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function printRegistrationLabel(url: string, title: string, location: string) {
  const printWindow = window.open("", "_blank", "width=760,height=960");

  if (!printWindow) {
    window.alert("Unable to open print window.");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #102a43;
          }
          h1 {
            margin-bottom: 12px;
          }
          p {
            font-size: 14px;
            line-height: 1.5;
          }
          .qr {
            margin: 24px 0;
          }
          img {
            width: 280px;
            height: 280px;
          }
          .url {
            padding: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            word-break: break-all;
            background: #f8fafc;
          }
        </style>
      </head>
      <body>
        <h1>${escapePrintHtml(title)}</h1>
        <p><strong>Location:</strong> ${escapePrintHtml(location)}</p>
        <p>Scan this QR code to submit a POCT training request.</p>
        <div class="qr"><img alt="QR code" src="${url}" /></div>
        <div class="url">${escapePrintHtml(url)}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function QrPreview({
  className,
  value,
}: {
  className?: string;
  value: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(value, {
      width: 220,
      margin: 1,
      color: {
        dark: "#102a43",
        light: "#ffffff",
      },
    }).then((url: string) => {
      if (!cancelled) {
        setDataUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className={`poct-qr-skeleton ${className || ""}`} />;
  }

  return <img className={className} src={dataUrl} alt="Registration QR code" />;
}

export function PoctRequestPanel({
  currentUser,
  labs,
  registrationLinks,
  requests,
  onCreateRegistrationLink,
  onDeleteRegistrationLink,
  onUpdateRegistrationLinkStatus,
  onReplyToRequest,
}: PoctRequestPanelProps) {
  const poctLabs = useMemo(() => labs.filter((lab) => lab.is_poc), [labs]);
  const [labId, setLabId] = useState<number | "">("");
  const [defaultTrainingLocation, setDefaultTrainingLocation] = useState(
    "A/E reception",
  );
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
  const [replyStatus, setReplyStatus] = useState<"scheduled" | "cancelled">(
    "scheduled",
  );
  const [trainingLocation, setTrainingLocation] = useState("A/E reception");
  const [trainingTimeDetails, setTrainingTimeDetails] = useState("");
  const [trainerMessage, setTrainerMessage] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [requestHospitalFilter, setRequestHospitalFilter] = useState("all");
  const [requestDeviceFilter, setRequestDeviceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLinkCode, setCopiedLinkCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeLinkCount = useMemo(
    () => registrationLinks.filter((link) => link.is_active).length,
    [registrationLinks],
  );

  const groupedRequests = useMemo(() => {
    const groups = new Map<string, RequestGroup>();

    requests.forEach((request) => {
      const key = buildGroupKey(request);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          hospitalName: request.trainee_hospital_name,
          deviceName: request.lab_name,
          locationName: request.training_location || "Location not set",
          status: request.trainer_reply_status,
          latestRequestedAt: request.requested_at,
          requests: [],
        });
      }

      const group = groups.get(key);

      if (!group) {
        return;
      }

      group.requests.push(request);

      if (
        new Date(request.requested_at).getTime() >
        new Date(group.latestRequestedAt).getTime()
      ) {
        group.latestRequestedAt = request.requested_at;
      }
    });

    return Array.from(groups.values()).sort(
      (left, right) =>
        new Date(right.latestRequestedAt).getTime() -
        new Date(left.latestRequestedAt).getTime(),
    );
  }, [requests]);

  const hospitalOptions = useMemo(
    () =>
      Array.from(new Set(requests.map((request) => request.trainee_hospital_name))),
    [requests],
  );

  const deviceOptions = useMemo(
    () => Array.from(new Set(requests.map((request) => request.lab_name))),
    [requests],
  );

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return groupedRequests.filter((group) => {
      if (
        requestStatusFilter !== "all" &&
        group.status !== requestStatusFilter
      ) {
        return false;
      }

      if (
        requestHospitalFilter !== "all" &&
        group.hospitalName !== requestHospitalFilter
      ) {
        return false;
      }

      if (requestDeviceFilter !== "all" && group.deviceName !== requestDeviceFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return group.requests.some((request) =>
        [
          request.trainee_name,
          request.trainee_email,
          request.trainee_hospital_name,
          request.lab_name,
          request.training_location || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      );
    });
  }, [
    groupedRequests,
    requestDeviceFilter,
    requestHospitalFilter,
    requestStatusFilter,
    searchQuery,
  ]);

  const selectedRequests = useMemo(
    () =>
      requests.filter((request) => selectedRequestIds.includes(request.id)),
    [requests, selectedRequestIds],
  );

  const primarySelectedRequest = selectedRequests[0] ?? null;

  useEffect(() => {
    const validIds = selectedRequestIds.filter((requestId) =>
      requests.some((request) => request.id === requestId),
    );

    if (validIds.length === selectedRequestIds.length) {
      return;
    }

    setSelectedRequestIds(validIds);
  }, [requests, selectedRequestIds]);

  const toggleRequestSelection = (requestId: number) => {
    setSelectedRequestIds((currentSelection) =>
      currentSelection.includes(requestId)
        ? currentSelection.filter((id) => id !== requestId)
        : [...currentSelection, requestId],
    );
  };

  const selectWholeGroup = (group: RequestGroup) => {
    const groupIds = group.requests.map((request) => request.id);

    setSelectedRequestIds((currentSelection) => {
      const hasAll = groupIds.every((id) => currentSelection.includes(id));

      return hasAll
        ? currentSelection.filter((id) => !groupIds.includes(id))
        : Array.from(new Set([...currentSelection, ...groupIds]));
    });

    setTrainingLocation(
      group.requests[0]?.training_location ||
        group.locationName ||
        "A/E reception",
    );
    setTrainingTimeDetails(group.requests[0]?.training_time_details || "");
    setTrainerMessage(group.requests[0]?.trainer_message || "");
  };

  return (
    <section className="columns is-multiline">
      <div className="column is-5-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">POCT registration</p>
              <h2 className="title is-5">Create QR request link</h2>
            </div>
            <span className="tag is-light">
              {activeLinkCount} active / {registrationLinks.length} total
            </span>
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
                  onChange={(event) =>
                    setLabId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
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
              {filteredGroups.length} groups
            </span>
          </div>

          <div className="request-filter-grid">
            <div className="field">
              <label className="label" htmlFor="poct-filter-status">
                Status
              </label>
              <div className="select is-fullwidth">
                <select
                  id="poct-filter-status"
                  value={requestStatusFilter}
                  onChange={(event) => setRequestStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending_trainer_reply">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="poct-filter-hospital">
                Hospital
              </label>
              <div className="select is-fullwidth">
                <select
                  id="poct-filter-hospital"
                  value={requestHospitalFilter}
                  onChange={(event) =>
                    setRequestHospitalFilter(event.target.value)
                  }
                >
                  <option value="all">All hospitals</option>
                  {hospitalOptions.map((hospitalName) => (
                    <option key={hospitalName} value={hospitalName}>
                      {hospitalName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="poct-filter-device">
                Device
              </label>
              <div className="select is-fullwidth">
                <select
                  id="poct-filter-device"
                  value={requestDeviceFilter}
                  onChange={(event) => setRequestDeviceFilter(event.target.value)}
                >
                  <option value="all">All devices</option>
                  {deviceOptions.map((deviceName) => (
                    <option key={deviceName} value={deviceName}>
                      {deviceName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="poct-filter-search">
                Search
              </label>
              <input
                id="poct-filter-search"
                className="input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Name, email, hospital, or location"
              />
            </div>
          </div>

          <div className="scroll-list poct-scroll-list">
            {filteredGroups.map((group) => {
              const selectedCount = group.requests.filter((request) =>
                selectedRequestIds.includes(request.id),
              ).length;

              return (
                <article key={group.key} className="list-card poct-group-card">
                  <div className="poct-group-header">
                    <div>
                      <p className="list-title">
                        {group.hospitalName} · {group.deviceName}
                      </p>
                      <p className="mini-note">
                        {group.locationName} · {group.requests.length} request
                        {group.requests.length === 1 ? "" : "s"} · latest{" "}
                        {formatDateTime(group.latestRequestedAt)}
                      </p>
                    </div>
                    <div className="poct-inline-actions">
                      <span className="tag is-light">{group.status}</span>
                      <button
                        className="button is-small is-light"
                        type="button"
                        onClick={() => selectWholeGroup(group)}
                      >
                        {selectedCount === group.requests.length
                          ? "Unselect group"
                          : "Select group"}
                      </button>
                    </div>
                  </div>

                  <div className="poct-chip-grid">
                    {group.requests.map((request) => {
                      const isSelected = selectedRequestIds.includes(request.id);

                      return (
                        <button
                          key={request.id}
                          className={`poct-request-chip ${
                            isSelected ? "is-selected" : ""
                          }`}
                          type="button"
                          onClick={() => toggleRequestSelection(request.id)}
                        >
                          <strong>{request.trainee_name}</strong>
                          <span>{request.trainee_email}</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}

            {filteredGroups.length === 0 ? (
              <p className="empty-state">
                No POCT requests match the current filters.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">QR labels</p>
              <h2 className="title is-5">Print or share registration QR codes</h2>
            </div>
          </div>

          {message ? (
            <div className="notification is-success is-light">{message}</div>
          ) : null}
          {errorMessage ? (
            <div className="notification is-danger is-light">
              {errorMessage}
            </div>
          ) : null}

          <div className="scroll-list poct-link-grid">
            {registrationLinks.map((link) => {
              const url = buildRegistrationUrl(link.code);

              return (
                <article key={link.code} className="poct-link-card">
                  <QrPreview className="poct-qr-preview" value={url} />
                  <div>
                    <p className="list-title">
                      {link.department_name} / {link.lab_name}
                    </p>
                    <p className="mini-note">
                      {link.default_training_location || "Location not set"}
                    </p>
                    <p className="mini-note">
                      <span
                        className={`tag ${
                          link.is_active ? "is-success" : "is-light"
                        }`}
                      >
                        {link.is_active ? "Active" : "Inactive"}
                      </span>
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
                    <button
                      className="button is-small is-link is-light"
                      type="button"
                      onClick={() =>
                        printRegistrationLabel(
                          url,
                          link.lab_name,
                          link.default_training_location || "Location not set",
                        )
                      }
                      disabled={!link.is_active}
                    >
                      Print label
                    </button>
                    <button
                      className="button is-small is-light"
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        const nextStatus = !link.is_active;

                        setMessage(null);
                        setErrorMessage(null);

                        startTransition(() => {
                          void onUpdateRegistrationLinkStatus(
                            link.code,
                            nextStatus,
                          )
                            .then(() => {
                              setMessage(
                                nextStatus
                                  ? "POCT registration link activated."
                                  : "POCT registration link deactivated.",
                              );
                            })
                            .catch((error) => {
                              setErrorMessage(
                                error instanceof Error
                                  ? error.message
                                  : "Unable to update POCT registration link",
                              );
                            });
                        });
                      }}
                    >
                      {link.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="button is-small is-danger is-light"
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Delete the ${link.lab_name} registration link? This only works if no requests were submitted through it.`,
                        );

                        if (!confirmed) {
                          return;
                        }

                        setMessage(null);
                        setErrorMessage(null);

                        startTransition(() => {
                          void onDeleteRegistrationLink(link.code)
                            .then(() => {
                              setMessage("POCT registration link deleted.");
                            })
                            .catch((error) => {
                              setErrorMessage(
                                error instanceof Error
                                  ? error.message
                                  : "Unable to delete POCT registration link",
                              );
                            });
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}

            {registrationLinks.length === 0 ? (
              <p className="empty-state">
                Create a registration link to generate a QR code for a POCT
                device.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="column is-6-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Batch scheduler</p>
              <h2 className="title is-5">
                {selectedRequests.length > 0
                  ? `Reply to ${selectedRequests.length} selected request${
                      selectedRequests.length === 1 ? "" : "s"
                    }`
                  : "Select requests to schedule or cancel"}
              </h2>
            </div>
          </div>

          {selectedRequests.length > 0 ? (
            <form
              className="stacked-form"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(null);
                setErrorMessage(null);

                startTransition(() => {
                  void Promise.all(
                    selectedRequests.map((request) =>
                      onReplyToRequest(request.id, {
                        trainerReplyStatus: replyStatus,
                        trainingLocation,
                        trainingTimeDetails,
                        trainerMessage,
                      }),
                    ),
                  )
                    .then(() => {
                      setMessage(
                        `${selectedRequests.length} request${
                          selectedRequests.length === 1 ? "" : "s"
                        } updated and email notifications sent.`,
                      );
                      setSelectedRequestIds([]);
                    })
                    .catch((error) => {
                      setErrorMessage(
                        error instanceof Error
                          ? error.message
                          : "Unable to update POCT requests",
                      );
                    });
                });
              }}
            >
              <div className="poct-request-focus">
                <p className="list-title">
                  {primarySelectedRequest?.lab_name} ·{" "}
                  {primarySelectedRequest?.trainee_hospital_name}
                </p>
                <p className="mini-note">
                  Selected:{" "}
                  {selectedRequests
                    .map((request) => request.trainee_name)
                    .slice(0, 4)
                    .join(", ")}
                  {selectedRequests.length > 4 ? " ..." : ""}
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
                Save replies and send emails
              </button>
            </form>
          ) : (
            <p className="empty-state">
              Select one request, a whole group, or multiple requests from the
              queue to schedule them together.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
