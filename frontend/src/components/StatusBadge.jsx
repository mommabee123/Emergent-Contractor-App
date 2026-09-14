import { STATUS_STYLE } from "../lib/format";

export default function StatusBadge({ status, className = "" }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.Lead;
  return (
    <span
      data-testid="job-status-badge"
      className={`pill-status ${className}`}
      style={{ background: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}
