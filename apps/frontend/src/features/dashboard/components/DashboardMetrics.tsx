interface DashboardMetricsProps {
  labCount: number;
  activeTemplateCount: number;
  dueSoonCount: number;
  activeAssignmentCount: number;
}

export function DashboardMetrics({
  labCount,
  activeTemplateCount,
  dueSoonCount,
  activeAssignmentCount,
}: DashboardMetricsProps) {
  const metrics = [
    {
      label: "Labs",
      value: labCount,
      helper: "Sections available in your scope",
      accent: false,
    },
    {
      label: "Templates",
      value: activeTemplateCount,
      helper: "Active digital competency forms",
      accent: false,
    },
    {
      label: "Assignments",
      value: activeAssignmentCount,
      helper: "Current section training assignments",
      accent: false,
    },
    {
      label: "Due < 30 days",
      value: dueSoonCount,
      helper: "Needs trainer/co-ordinator follow-up",
      accent: true,
    },
  ];

  return (
    <section className="columns is-multiline">
      {metrics.map((metric) => (
        <div className="column is-3-desktop is-6-tablet" key={metric.label}>
          <article className={`metric-card ${metric.accent ? "accent" : ""}`}>
            <p className="metric-label">{metric.label}</p>
            <p className="metric-value">{metric.value}</p>
            <p className="metric-helper">{metric.helper}</p>
          </article>
        </div>
      ))}
    </section>
  );
}
