import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  CreateTemplateInput,
  LabSummary,
  TemplateSummary,
} from "../api";

interface TemplatesPanelProps {
  labs: LabSummary[];
  templates: TemplateSummary[];
  onCreateTemplate: (input: CreateTemplateInput) => Promise<void>;
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

const defaultSchemaText = JSON.stringify(
  {
    formTitle: "Training Event and Competency Assessment Form",
    sections: [
      {
        type: "training_event",
        code: "TE/NEW-SECTION",
        description: "Describe the section training and related SOPs here.",
        objectives: [
          "Complete supervised practice in the section",
          "Demonstrate key maintenance/QC/sample-processing tasks",
        ],
        referenceDocuments: ["PPG-CUH-PAT-XXXX"],
      },
      {
        type: "competency_assessment",
        code: "CA/NEW-SECTION",
        tasks: [
          {
            taskLabel: "Document one competency task here",
            method: "DOWP",
          },
        ],
      },
      {
        type: "signature_block",
        fields: [
          "trainer",
          "scheduled_date",
          "completed_date",
          "trainee_signature_date",
        ],
      },
    ],
  },
  null,
  2
);

export function TemplatesPanel({
  labs,
  templates,
  onCreateTemplate,
}: TemplatesPanelProps) {
  const [labId, setLabId] = useState(() => labs[0]?.id || 1);
  const [name, setName] = useState("FOR-CUH-PAT-2 New Section");
  const [formFamilyReference, setFormFamilyReference] =
    useState("FOR-CUH-PAT-2");
  const [templateKind, setTemplateKind] = useState(
    "training_event_competency"
  );
  const [targetStaffType, setTargetStaffType] = useState(
    "basic_grade_scientist"
  );
  const [isActive, setIsActive] = useState(true);
  const [schemaText, setSchemaText] = useState(defaultSchemaText);
  const [searchTerm, setSearchTerm] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
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

  return (
    <section className="columns is-multiline">
      <div className="column is-5-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Template setup</p>
              <h2 className="title is-5">Create section template</h2>
            </div>
            <span className="tag is-info is-light">{labs.length} labs</span>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setFormMessage(null);

              let schemaJson: Record<string, unknown>;

              try {
                schemaJson = JSON.parse(schemaText) as Record<string, unknown>;
              } catch {
                setFormMessage("Schema JSON is not valid.");
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
                  schemaJson,
                })
                  .then(() => {
                    setFormMessage("Template created successfully.");
                    setName("FOR-CUH-PAT-2 New Section");
                    setSchemaText(defaultSchemaText);
                  })
                  .catch((error) => {
                    setFormMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create template"
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="template-lab">
                Lab section
              </label>
              <div className="select is-fullwidth">
                <select
                  id="template-lab"
                  value={labId}
                  onChange={(event) => setLabId(Number(event.target.value))}
                >
                  {labs.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.hospital_name} · {lab.department_name} /{" "}
                      {lab.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="template-name">
                Template name
              </label>
              <input
                id="template-name"
                className="input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="columns is-mobile is-variable is-2">
              <div className="column is-6">
                <label className="label" htmlFor="template-family">
                  Form family
                </label>
                <input
                  id="template-family"
                  className="input"
                  type="text"
                  value={formFamilyReference}
                  onChange={(event) =>
                    setFormFamilyReference(event.target.value)
                  }
                />
              </div>

              <div className="column is-6">
                <label className="label" htmlFor="template-kind">
                  Template type
                </label>
                <div className="select is-fullwidth">
                  <select
                    id="template-kind"
                    value={templateKind}
                    onChange={(event) =>
                      setTemplateKind(event.target.value)
                    }
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
                <label className="label" htmlFor="template-staff-type">
                  Target staff type
                </label>
                <div className="select is-fullwidth">
                  <select
                    id="template-staff-type"
                    value={targetStaffType}
                    onChange={(event) =>
                      setTargetStaffType(event.target.value)
                    }
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
                <label className="label" htmlFor="template-active">
                  Active
                </label>
                <label className="checkbox template-active-toggle">
                  <input
                    id="template-active"
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                  />{" "}
                  Publish
                </label>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="template-schema">
                Initial schema JSON
              </label>
              <textarea
                id="template-schema"
                className="textarea template-schema-editor"
                value={schemaText}
                onChange={(event) => setSchemaText(event.target.value)}
                spellCheck="false"
              />
            </div>

            {formMessage ? <p className="mini-note">{formMessage}</p> : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending}
            >
              Create template
            </button>
          </form>
        </section>
      </div>

      <div className="column is-7-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Form library</p>
              <h2 className="title is-5">Template library</h2>
            </div>
            <span className="tag is-info is-light">
              {filteredTemplates.length}
            </span>
          </div>

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
  );
}
