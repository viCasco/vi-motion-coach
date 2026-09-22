type MetricCardProps = {
  label: string;
  value: number | null;
  unit?: string;
  detail?: string;
};

export function MetricCard({ label, value, unit = '°', detail }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value === null ? '—' : value}
        {value !== null && <span>{unit}</span>}
      </div>
      {detail && <div className="metric-detail">{detail}</div>}
    </article>
  );
}
