export const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n || 0));

export const moneyCompact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return money(v).replace(/\.00$/, "");
  return money(v);
};

export const usDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const STATUSES = ["Lead", "Estimated", "Approved", "In Progress", "Complete", "Invoiced", "Paid"];

// Filled pill styles (bg + text). No borders. Only the allowed palette.
export const STATUS_STYLE = {
  Lead: { bg: "#24211D", text: "#A39990" },
  Estimated: { bg: "#2F7DE1", text: "#FFFFFF" },
  Approved: { bg: "#F5F1EA", text: "#12110F" },
  "In Progress": { bg: "#F5F1EA", text: "#12110F" },
  Complete: { bg: "#2EB872", text: "#FFFFFF" },
  Invoiced: { bg: "#2F7DE1", text: "#FFFFFF" },
  Paid: { bg: "#2EB872", text: "#FFFFFF" },
};

// Profit color helper: green healthy (>=20%), amber thin (5-19%), red losing (<5%)
export const profitColor = (profit, pct) => {
  if (profit < 0 || pct < 5) return "var(--red)";
  if (pct < 20) return "var(--amber)";
  return "var(--green)";
};
