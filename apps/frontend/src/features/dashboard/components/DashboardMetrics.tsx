interface DashboardMetric {
  label: string;
  value: number;
  helper: string;
  accent?: boolean;
}

interface DashboardMetricsProps {
  metrics: DashboardMetric[];
  variant?: "cards" | "compact";
}

export function DashboardMetrics({
  metrics,
  variant = "cards",
}: DashboardMetricsProps) {
  if (variant === "compact") {
    return (
      <section className="metric-strip" aria-label="Dashboard summary">
        {metrics.map((metric) => (
          <article
            className={`metric-strip-item ${metric.accent ? "accent" : ""}`}
            key={metric.label}
          >
            <span className="metric-strip-label">{metric.label}</span>
            <strong className="metric-strip-value">{metric.value}</strong>
            <span className="metric-strip-helper">{metric.helper}</span>
          </article>
        ))}
      </section>
    );
  }

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
