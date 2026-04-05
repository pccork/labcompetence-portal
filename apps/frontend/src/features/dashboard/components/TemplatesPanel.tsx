import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  CreateTemplateInput,
  LabSummary,
  TemplateDetail,
  TemplateSummary,
} from "../api";
import { CurrentUser } from "../../auth/api";
import { downloadTemplateDocument } from "../../../shared/export/reportExport";
import { confirmManagedAction } from "./managementConfirm";

interface TemplatesPanelProps {
  currentUser: CurrentUser;
  labs: LabSummary[];
  templates: TemplateSummary[];
  isReadOnly?: boolean;
  onCreateTemplate: (input: CreateTemplateInput) => Promise<void>;
  onArchiveTemplate: (template: TemplateSummary) => Promise<void>;
  onFetchTemplateDetail: (
    templateId: number
  ) => Promise<{ template: TemplateDetail }>;
}

const staffTypeOptions = [
  { value: "basic_grade_scientist", label: "Basic Grade Scientist" },
  { value: "senior_medical_scientist", label: "Senior Medical Scientist" },
  { value: "medical_laboratory_aide", label: "Medical Laboratory Aide" },
  { value: "training_coordinator", label: "Training Co-ordinator" },
  { value: "poct_scientist", label: "POCT Scientist" },
  { value: "poct_medical_nursing", label: "POCT Medical/Nursing/Midwifery" },
];

const templateKindOptions = [
  {
    value: "training_event_competency",
    label: "Training Event + Competency",
  },
  { value: "competency_only", label: "Competency Only" },
  { value: "senior_staff_programme", label: "Senior Staff Programme" },
  { value: "poc_checklist", label: "POC Checklist" },
];

const defaultSignatureFields = [
  "trainer",
  "scheduled_date",
  "completed_date",
  "trainee_signature_date",
];

const defaultCompetencyTask = {
  taskLabel: "Document one competency task here",
  method: "DOWP",
};

function getDefaultObjectives() {
  return [
    "Complete supervised practice in the section",
    "Demonstrate key maintenance/QC/sample-processing tasks",
  ].join("\n");
}

function getDefaultReferences() {
  return ["PPG-CUH-PAT-XXXX"].join("\n");
}

export function TemplatesPanel({
  currentUser,
  labs,
  templates,
  isReadOnly = false,
  onCreateTemplate,
  onArchiveTemplate,
  onFetchTemplateDetail,
}: TemplatesPanelProps) {
  const [isExpandedEditorOpen, setIsExpandedEditorOpen] = useState(false);
  const [labId, setLabId] = useState(() => labs[0]?.id || 1);
  const [name, setName] = useState("FOR-CUH-PAT-2 New Section");
  const [formFamilyReference, setFormFamilyReference] =
    useState("FOR-CUH-PAT-2");
  const [formTitle, setFormTitle] = useState(
    "Training Event and Competency Assessment Form"
  );
  const [templateKind, setTemplateKind] = useState(
    "training_event_competency"
  );
  const [targetStaffType, setTargetStaffType] = useState(
    "basic_grade_scientist"
  );
  const [isActive, setIsActive] = useState(true);
  const [eventCode, setEventCode] = useState("TE/NEW-SECTION");
  const [eventDescription, setEventDescription] = useState(
    "Describe the section training and related SOPs here."
  );
  const [eventObjectivesText, setEventObjectivesText] = useState(
    getDefaultObjectives()
  );
  const [referenceDocumentsText, setReferenceDocumentsText] = useState(
    getDefaultReferences()
  );
  const [assessmentCode, setAssessmentCode] = useState("CA/NEW-SECTION");
  const [assessmentDescription, setAssessmentDescription] = useState(
    "Describe how the trainer will assess competence in this section."
  );
  const [assessmentObjectivesText, setAssessmentObjectivesText] = useState(
    "The trainer will deem the participant competent to perform the key tasks listed below."
  );
  const [competencyTasks, setCompetencyTasks] = useState([
    {
      ...defaultCompetencyTask,
    },
  ]);
  const [showGeneratedSchema, setShowGeneratedSchema] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [printMessage, setPrintMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const firstLab = labs[0];

    if (!firstLab) {
      return;
    }

    if (!labs.some((lab) => lab.id === labId)) {
      setLabId(firstLab.id);
    }
  }, [labId, labs]);

  const filteredTemplates = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return [...templates]
      .filter((template) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        return `${template.name} ${template.lab_name} ${template.form_family_reference} ${template.template_kind} ${template.target_staff_type}`
          .toLowerCase()
          .includes(normalizedSearchTerm);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [searchTerm, templates]);

  const selectedLab = useMemo(
    () => labs.find((lab) => lab.id === labId) ?? null,
    [labId, labs]
  );

  const generatedSchema = useMemo(() => {
    const eventObjectives = eventObjectivesText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const referenceDocuments = referenceDocumentsText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const assessmentObjectives = assessmentObjectivesText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      formTitle,
      formFamilyReference,
      sectionName: selectedLab?.name || "Selected training unit",
      documentTitle: name,
      sections: [
        ...(templateKind === "competency_only"
          ? []
          : [
              {
                type: "training_event",
                code: eventCode,
                description: eventDescription,
                objectives: eventObjectives,
                referenceDocuments,
              },
            ]),
        ...(templateKind === "training_event"
          ? []
          : [
              {
                type: "competency_assessment",
                code: assessmentCode,
                description: assessmentDescription,
                objectives: assessmentObjectives,
                tasks: competencyTasks.filter(
                  (task) => task.taskLabel.trim() || task.method.trim()
                ),
                referenceDocuments,
              },
            ]),
        {
          type: "signature_block",
          fields: defaultSignatureFields,
        },
      ],
    };
  }, [
    assessmentCode,
    assessmentDescription,
    assessmentObjectivesText,
    competencyTasks,
    eventCode,
    eventDescription,
    eventObjectivesText,
    formFamilyReference,
    formTitle,
    name,
    referenceDocumentsText,
    selectedLab?.name,
    templateKind,
  ]);

  const generatedSchemaText = useMemo(
    () => JSON.stringify(generatedSchema, null, 2),
    [generatedSchema]
  );

  const handleCreateTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);

    const confirmed = confirmManagedAction(
      currentUser,
      `Create template "${name}" for ${
        selectedLab
          ? `${selectedLab.department_name} / ${selectedLab.name}`
          : "the selected training unit"
      }?`,
      "Please confirm again to create this template."
    );

    if (!confirmed) {
      return;
    }

    startTransition(() => {
      void onCreateTemplate({
        name,
        labId,
        formFamilyReference,
        templateKind,
        targetStaffType,
        isActive,
        schemaJson: generatedSchema,
      })
        .then(() => {
          setFormMessage("Template created successfully.");
          setName("FOR-CUH-PAT-2 New Section");
          setFormTitle("Training Event and Competency Assessment Form");
          setEventCode("TE/NEW-SECTION");
          setEventDescription(
            "Describe the section training and related SOPs here."
          );
          setEventObjectivesText(getDefaultObjectives());
          setReferenceDocumentsText(getDefaultReferences());
          setAssessmentCode("CA/NEW-SECTION");
          setAssessmentDescription(
            "Describe how the trainer will assess competence in this section."
          );
          setAssessmentObjectivesText(
            "The trainer will deem the participant competent to perform the key tasks listed below."
          );
          setCompetencyTasks([{ ...defaultCompetencyTask }]);
          setShowGeneratedSchema(false);
          setIsExpandedEditorOpen(false);
        })
        .catch((error) => {
          setFormMessage(
            error instanceof Error
              ? error.message
              : "Unable to create template"
          );
        });
    });
  };

  const renderTemplateSetupForm = (expanded = false) => (
    <form
      className={`stacked-form ${expanded ? "template-setup-form-expanded" : ""}`}
      onSubmit={handleCreateTemplate}
    >
      <div className="field">
        <label className="label" htmlFor={expanded ? "template-lab-expanded" : "template-lab"}>
          Lab section
        </label>
        <div className="select is-fullwidth">
          <select
            id={expanded ? "template-lab-expanded" : "template-lab"}
            value={labId}
            onChange={(event) => setLabId(Number(event.target.value))}
          >
            {labs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.hospital_name} · {lab.department_name} / {lab.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label
          className="label"
          htmlFor={expanded ? "template-name-expanded" : "template-name"}
        >
          Template name
        </label>
        <input
          id={expanded ? "template-name-expanded" : "template-name"}
          className="input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="field">
        <label
          className="label"
          htmlFor={expanded ? "template-form-title-expanded" : "template-form-title"}
        >
          Printed form title
        </label>
        <input
          id={expanded ? "template-form-title-expanded" : "template-form-title"}
          className="input"
          type="text"
          value={formTitle}
          onChange={(event) => setFormTitle(event.target.value)}
        />
      </div>

      <div className="columns is-mobile is-variable is-2">
        <div className="column is-6">
          <label
            className="label"
            htmlFor={expanded ? "template-family-expanded" : "template-family"}
          >
            Form family
          </label>
          <input
            id={expanded ? "template-family-expanded" : "template-family"}
            className="input"
            type="text"
            value={formFamilyReference}
            onChange={(event) => setFormFamilyReference(event.target.value)}
          />
        </div>

        <div className="column is-6">
          <label
            className="label"
            htmlFor={expanded ? "template-kind-expanded" : "template-kind"}
          >
            Template type
          </label>
          <div className="select is-fullwidth">
            <select
              id={expanded ? "template-kind-expanded" : "template-kind"}
              value={templateKind}
              onChange={(event) => setTemplateKind(event.target.value)}
            >
              {templateKindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="columns is-mobile is-variable is-2">
        <div className="column is-8">
          <label
            className="label"
            htmlFor={
              expanded ? "template-staff-type-expanded" : "template-staff-type"
            }
          >
            Target staff type
          </label>
          <div className="select is-fullwidth">
            <select
              id={
                expanded ? "template-staff-type-expanded" : "template-staff-type"
              }
              value={targetStaffType}
              onChange={(event) => setTargetStaffType(event.target.value)}
            >
              {staffTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="column is-4">
          <label
            className="label"
            htmlFor={expanded ? "template-active-expanded" : "template-active"}
          >
            Active
          </label>
          <label className="checkbox template-active-toggle">
            <input
              id={expanded ? "template-active-expanded" : "template-active"}
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />{" "}
            Publish
          </label>
        </div>
      </div>

      <div className="field">
        <label
          className="label"
          htmlFor={
            expanded ? "template-event-description-expanded" : "template-event-description"
          }
        >
          Training event description
        </label>
        <div className="template-form-grid">
          <div className="field">
            <label
              className="label"
              htmlFor={expanded ? "template-event-code-expanded" : "template-event-code"}
            >
              Training event code
            </label>
            <input
              id={expanded ? "template-event-code-expanded" : "template-event-code"}
              className="input"
              type="text"
              value={eventCode}
              onChange={(event) => setEventCode(event.target.value)}
              disabled={templateKind === "competency_only"}
            />
          </div>

          <div className="field">
            <label
              className="label"
              htmlFor={
                expanded
                  ? "template-assessment-code-expanded"
                  : "template-assessment-code"
              }
            >
              Competency assessment code
            </label>
            <input
              id={
                expanded
                  ? "template-assessment-code-expanded"
                  : "template-assessment-code"
              }
              className="input"
              type="text"
              value={assessmentCode}
              onChange={(event) => setAssessmentCode(event.target.value)}
              disabled={templateKind === "training_event"}
            />
          </div>
        </div>

        {templateKind !== "competency_only" ? (
          <>
            <textarea
              id={
                expanded
                  ? "template-event-description-expanded"
                  : "template-event-description"
              }
              className="textarea"
              value={eventDescription}
              onChange={(event) => setEventDescription(event.target.value)}
            />

            <div className="field mt-4">
              <label
                className="label"
                htmlFor={
                  expanded
                    ? "template-event-objectives-expanded"
                    : "template-event-objectives"
                }
              >
                Training event objectives
              </label>
              <textarea
                id={
                  expanded
                    ? "template-event-objectives-expanded"
                    : "template-event-objectives"
                }
                className="textarea template-multiline-editor"
                value={eventObjectivesText}
                onChange={(event) => setEventObjectivesText(event.target.value)}
                spellCheck="false"
              />
              <p className="mini-note">
                One objective per line, matching the paper form.
              </p>
            </div>
          </>
        ) : null}

        {templateKind !== "training_event" ? (
          <>
            <div className="field mt-4">
              <label
                className="label"
                htmlFor={
                  expanded
                    ? "template-assessment-description-expanded"
                    : "template-assessment-description"
                }
              >
                Competency assessment description
              </label>
              <textarea
                id={
                  expanded
                    ? "template-assessment-description-expanded"
                    : "template-assessment-description"
                }
                className="textarea"
                value={assessmentDescription}
                onChange={(event) => setAssessmentDescription(event.target.value)}
              />
            </div>

            <div className="field mt-4">
              <label
                className="label"
                htmlFor={
                  expanded
                    ? "template-assessment-objectives-expanded"
                    : "template-assessment-objectives"
                }
              >
                Competency assessment objectives
              </label>
              <textarea
                id={
                  expanded
                    ? "template-assessment-objectives-expanded"
                    : "template-assessment-objectives"
                }
                className="textarea template-multiline-editor"
                value={assessmentObjectivesText}
                onChange={(event) =>
                  setAssessmentObjectivesText(event.target.value)
                }
                spellCheck="false"
              />
              <p className="mini-note">
                One objective per line.
              </p>
            </div>

            <div className="field mt-4">
              <label className="label">Competency tasks / methods</label>
              <div className="template-task-list">
                {competencyTasks.map((task, index) => (
                  <div className="template-task-row" key={`${index}-${task.method}`}>
                    <input
                      className="input"
                      type="text"
                      value={task.taskLabel}
                      onChange={(event) => {
                        setCompetencyTasks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  taskLabel: event.target.value,
                                }
                              : item
                          )
                        );
                      }}
                      placeholder="Task label"
                    />
                    <input
                      className="input"
                      type="text"
                      value={task.method}
                      onChange={(event) => {
                        setCompetencyTasks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  method: event.target.value,
                                }
                              : item
                          )
                        );
                      }}
                      placeholder="Method"
                    />
                    <button
                      className="button is-light"
                      type="button"
                      onClick={() => {
                        setCompetencyTasks((current) =>
                          current.length === 1
                            ? [{ ...defaultCompetencyTask }]
                            : current.filter((_, itemIndex) => itemIndex !== index)
                        );
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="button is-light mt-3"
                type="button"
                onClick={() => {
                  setCompetencyTasks((current) => [
                    ...current,
                    { ...defaultCompetencyTask },
                  ]);
                }}
              >
                Add competency task
              </button>
            </div>
          </>
        ) : null}

        <div className="field mt-4">
          <label
            className="label"
            htmlFor={
              expanded ? "template-references-expanded" : "template-references"
            }
          >
            Related documentation / reference material
          </label>
          <textarea
            id={expanded ? "template-references-expanded" : "template-references"}
            className="textarea template-multiline-editor"
            value={referenceDocumentsText}
            onChange={(event) => setReferenceDocumentsText(event.target.value)}
            spellCheck="false"
          />
          <p className="mini-note">
            One SOP, policy, form, or reference per line.
          </p>
        </div>

        <div className="field mt-4">
          <label className="label">Signature block</label>
          <div className="template-signature-list">
            {defaultSignatureFields.map((field) => (
              <span className="tag is-light" key={field}>
                {field.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        </div>

        <div className="field mt-4">
          <button
            className="button is-light"
            type="button"
            onClick={() => setShowGeneratedSchema((current) => !current)}
          >
            {showGeneratedSchema ? "Hide" : "Show"} generated schema preview
          </button>
        </div>

        {showGeneratedSchema ? (
          <div className="field">
            <label
              className="label"
              htmlFor={
                expanded ? "template-schema-expanded" : "template-schema"
              }
            >
              Generated schema preview
            </label>
            <textarea
              id={expanded ? "template-schema-expanded" : "template-schema"}
              className={`textarea template-schema-editor ${
                expanded ? "template-schema-editor-expanded" : ""
              }`}
              value={generatedSchemaText}
              readOnly
              spellCheck="false"
            />
          </div>
        ) : null}
      </div>

      {formMessage ? <p className="mini-note">{formMessage}</p> : null}

      <div className={expanded ? "template-editor-actions" : undefined}>
        {expanded ? (
          <button
            className="button is-light"
            type="button"
            onClick={() => setIsExpandedEditorOpen(false)}
          >
            Close full editor
          </button>
        ) : null}

        <button
          className={`button is-link ${expanded ? "" : "is-fullwidth"} ${
            isPending ? "is-loading" : ""
          }`}
          type="submit"
          disabled={isPending}
        >
          Create template
        </button>
      </div>
    </form>
  );

  return (
    <>
      {isExpandedEditorOpen && !isReadOnly ? (
        <div className="template-editor-overlay" role="dialog" aria-modal="true">
          <div className="template-editor-modal panel-card">
            <div className="panel-heading-row">
              <div>
                <p className="panel-kicker">Template setup</p>
                <h2 className="title is-4">Full-screen template editor</h2>
              </div>
              <button
                className="button is-light"
                type="button"
                onClick={() => setIsExpandedEditorOpen(false)}
              >
                Close
              </button>
            </div>
            {renderTemplateSetupForm(true)}
          </div>
        </div>
      ) : null}
      <section className="columns is-multiline">
      {!isReadOnly ? (
        <div className="column is-5-desktop">
          <section className="panel-card">
            <div className="panel-heading-row">
              <div>
                <p className="panel-kicker">Template setup</p>
                <h2 className="title is-5">Create section template</h2>
              </div>
              <div className="panel-heading-actions">
                <button
                  className="button is-light is-small"
                  type="button"
                  onClick={() => setIsExpandedEditorOpen(true)}
                >
                  Open full editor
                </button>
                <span className="tag is-info is-light">{labs.length} labs</span>
              </div>
            </div>

            {renderTemplateSetupForm()}
          </section>
        </div>
      ) : null}

      <div className={isReadOnly ? "column is-12" : "column is-7-desktop"}>
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Form library</p>
              <h2 className="title is-5">
                {isReadOnly ? "Template library view" : "Template library"}
              </h2>
            </div>
            <span className="tag is-info is-light">
              {filteredTemplates.length}
            </span>
          </div>

          {isReadOnly ? (
            <p className="mini-note mb-4">
              Global admins can review template coverage here, but template
              creation and updates stay with local admin / training coordinator
              accounts.
            </p>
          ) : null}

          {printMessage ? <p className="mini-note">{printMessage}</p> : null}

          <div className="field">
            <label className="label" htmlFor="template-search">
              Search templates
            </label>
            <input
              id="template-search"
              className="input"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, lab, form family, staff type"
            />
          </div>

          <div className="scroll-list template-list">
            {filteredTemplates.length === 0 ? (
              <p className="empty-state">No templates available yet.</p>
            ) : (
              filteredTemplates.map((template) => (
                <article className="list-card" key={template.id}>
                  <div>
                    <h3 className="list-title">{template.name}</h3>
                    <p className="list-meta">
                      {template.form_family_reference} ·{" "}
                      {template.department_name} / {template.lab_name} ·{" "}
                      {template.lab_hospital_name}
                    </p>
                    <p className="mini-note">
                      {template.template_kind.replaceAll("_", " ")} ·{" "}
                      {template.target_staff_type.replaceAll("_", " ")}
                    </p>
                  </div>

                  <div className="tag-stack">
                    {template.is_active && !isReadOnly ? (
                      <button
                        className="button is-danger is-light is-small"
                        type="button"
                        onClick={() => {
                          setPrintMessage(null);

                          const confirmed = confirmManagedAction(
                            currentUser,
                            `Archive template "${template.name}"? It will stay in the system for record history but stop appearing as an active template.`,
                            "Please confirm again to archive this template."
                          );

                          if (!confirmed) {
                            return;
                          }

                          startTransition(() => {
                            void onArchiveTemplate(template).catch((error) => {
                              setPrintMessage(
                                error instanceof Error
                                  ? error.message
                                  : "Unable to archive template"
                              );
                            });
                          });
                        }}
                      >
                        Archive
                      </button>
                    ) : null}
                    <button
                      className="button is-light is-small"
                      type="button"
                      onClick={() => {
                        setPrintMessage(null);

                        startTransition(() => {
                          void onFetchTemplateDetail(template.id)
                            .then((response) => {
                              const templateDetail = response.template;
                              const latestVersion =
                                templateDetail.versions[0] || null;

                              downloadTemplateDocument({
                                filename: `${templateDetail.name
                                  .toLowerCase()
                                  .replaceAll(/[^a-z0-9]+/g, "-")
                                  .replaceAll(/^-|-$/g, "") || "template"}-v${
                                  latestVersion?.version_number ||
                                  templateDetail.latest_version_number ||
                                  1
                                }.docx`,
                                generatedBy: "Lab competence portal",
                                title: templateDetail.name,
                                subtitle: `${templateDetail.form_family_reference} · ${templateDetail.department_name} / ${templateDetail.lab_name} · ${templateDetail.lab_hospital_name}`,
                                details: [
                                  {
                                    label: "Template type",
                                    value: templateDetail.template_kind.replaceAll(
                                      "_",
                                      " "
                                    ),
                                  },
                                  {
                                    label: "Target staff type",
                                    value:
                                      templateDetail.target_staff_type.replaceAll(
                                        "_",
                                        " "
                                      ),
                                  },
                                  {
                                    label: "Latest version",
                                    value:
                                      latestVersion?.version_number ||
                                      templateDetail.latest_version_number ||
                                      1,
                                  },
                                  {
                                    label: "Status",
                                    value: templateDetail.is_active
                                      ? "Active"
                                      : "Inactive",
                                  },
                                  {
                                    label: "Department",
                                    value:
                                      templateDetail.department_name,
                                  },
                                  {
                                    label: "Training unit",
                                    value: templateDetail.lab_name,
                                  },
                                ],
                                schemaJson: latestVersion?.schema_json,
                              });
                            })
                            .catch((error) => {
                              setPrintMessage(
                                error instanceof Error
                                  ? error.message
                                  : "Unable to print template"
                              );
                            });
                        });
                      }}
                    >
                      Download DOCX
                    </button>
                    <span className="tag is-link is-light">
                      v{template.latest_version_number || 1}
                    </span>
                    {template.is_active ? (
                      <span className="tag is-success is-light">active</span>
                    ) : (
                      <span className="tag is-light">inactive</span>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      </section>
    </>
  );
}
