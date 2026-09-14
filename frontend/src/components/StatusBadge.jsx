import { STATUS_STYLE } from "../lib/format";

export default function StatusBadge({ status, className = "" }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.Lead;
  return (
    <span
      data-testid="job-status-badge"
      className={`inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-sm ${style} ${className}`}
    >
      {status}
    </span>
  );
}
