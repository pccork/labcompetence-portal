interface DashboardMetric {
  label: string;
  value: number;
  helper: string;
  accent?: boolean;
}

interface DashboardMetricsProps {
  metrics: DashboardMetric[];
}

export function DashboardMetrics({
  metrics,
}: DashboardMetricsProps) {
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
