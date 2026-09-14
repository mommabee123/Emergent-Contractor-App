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

export const STATUS_STYLE = {
  Lead: "bg-slate-800 border-slate-500 text-slate-200",
  Estimated: "bg-slate-900 border-blue-500 text-blue-300",
  Approved: "bg-emerald-950 border-emerald-500 text-emerald-300",
  "In Progress": "bg-orange-950 border-[#FF5F15] text-orange-200",
  Complete: "bg-emerald-950 border-emerald-600 text-emerald-200",
  Invoiced: "bg-indigo-950 border-indigo-500 text-indigo-200",
  Paid: "bg-emerald-900 border-green-500 text-green-200",
};
