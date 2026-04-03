import { TemplateSummary } from "../api";

interface TemplatesPanelProps {
  templates: TemplateSummary[];
}

export function TemplatesPanel({ templates }: TemplatesPanelProps) {
  return (
    <section className="panel-card">
      <div className="panel-heading-row">
        <div>
          <p className="panel-kicker">Form library</p>
          <h2 className="title is-5">Template library</h2>
        </div>
        <span className="tag is-info is-light">{templates.length}</span>
      </div>

      <div className="scroll-list">
        {templates.length === 0 ? (
          <p className="empty-state">No templates available yet.</p>
        ) : (
          templates.map((template) => (
            <article className="list-card" key={template.id}>
              <div>
                <h3 className="list-title">{template.name}</h3>
                <p className="list-meta">
                  {template.form_family_reference} · {template.lab_name}
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
  );
}
