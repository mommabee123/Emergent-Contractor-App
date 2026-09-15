import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { EXPENSE_CATEGORIES, apiError } from "../lib/expenses";
import { money } from "../lib/format";
import { useReceipts } from "../context/ReceiptContext";
import { ExpenseList } from "../components/ExpenseList";

export default function Expenses() {
  const [search] = useSearchParams();
  const { revision, openReceipt } = useReceipts();
  const [filters, setFilters] = useState({ job_id: search.get("job") || "", date_from: "", date_to: "", category: "", vendor: "" });
  const [unsorted, setUnsorted] = useState(search.get("tray") === "unsorted");
  const [result, setResult] = useState({ items: [], total: 0, count: 0, unsorted_count: 0 });
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [retry, setRetry] = useState(0);
  const params = Object.fromEntries(Object.entries({ ...filters, unsorted }).filter(([, value]) => value !== ""));
  useEffect(() => { api.get("/jobs", { params: { include_archived: true } }).then(({ data }) => setJobs(data)).catch(() => setError("Could not load job filters.")); }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/expenses", { params: Object.fromEntries(Object.entries({ ...filters, unsorted }).filter(([, value]) => value !== "")) });
        if (active) { setResult(data); setError(""); }
      } catch (e) { if (active) setError(apiError(e, "Could not load expenses.")); }
      finally { if (active) setLoading(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, unsorted, revision, retry]);
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await api.get("/expenses", { params: { ...params, export: true }, responseType: "blob" });
      const url = URL.createObjectURL(data); const link = document.createElement("a");
      link.href = url; link.download = "jobsite-expenses.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error("CSV export failed. Please retry."); }
    finally { setExporting(false); }
  };
  return <div className="space-y-6" data-testid="expenses-screen">
    <header className="flex items-center justify-between gap-3"><h1 className="text-3xl font-bold uppercase tracking-wide">Expenses</h1>
      <button data-testid="expenses-export" onClick={exportCsv} disabled={exporting || loading || Boolean(error)} className="btn-elev"><Download className="w-4 h-4" />{exporting ? "Exporting…" : "CSV"}</button></header>
    <div className="flex gap-3 border-b border-[#3D3830] pb-3"><button data-testid="expenses-all-tab" aria-pressed={!unsorted} className={`btn-elev ${!unsorted ? "!text-[#2F7DE1] !border-[#2F7DE1]" : ""}`} onClick={() => setUnsorted(false)}>All expenses</button>
      <button data-testid="expenses-unsorted-tab" aria-pressed={unsorted} className={`btn-elev ${unsorted ? "!text-[#2F7DE1] !border-[#2F7DE1]" : ""}`} onClick={() => setUnsorted(true)}>Unsorted <span data-testid="expenses-unsorted-count" className="font-mono-num">{result.unsorted_count}</span></button></div>
    {unsorted && <p data-testid="expenses-unsorted-help" className="text-[#A39990]">Receipts waiting for a job or category. Tap Review to assign them.</p>}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <label><span className="label-up">Job</span><select data-testid="expenses-filter-job" className="input-field" value={filters.job_id} onChange={(e) => setFilter("job_id", e.target.value)}><option value="">All jobs</option>{jobs.map((j) => <option key={j.id} value={j.id}>{`#${j.job_number} · ${j.title}`}</option>)}</select></label>
      <label><span className="label-up">Category</span><select data-testid="expenses-filter-category" className="input-field" value={filters.category} onChange={(e) => setFilter("category", e.target.value)}><option value="">All categories</option>{EXPENSE_CATEGORIES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label><span className="label-up">From</span><input data-testid="expenses-filter-from" className="input-field" type="date" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} /></label>
      <label><span className="label-up">Through</span><input data-testid="expenses-filter-to" className="input-field" type="date" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} /></label>
      <label><span className="label-up">Vendor</span><input data-testid="expenses-filter-vendor" className="input-field" placeholder="Search vendor" value={filters.vendor} onChange={(e) => setFilter("vendor", e.target.value)} /></label>
      <button data-testid="expenses-clear-filters" className="btn-elev self-end" onClick={() => setFilters({ job_id: "", date_from: "", date_to: "", category: "", vendor: "" })}>Clear filters</button>
    </div>
    <div className="flex flex-wrap justify-between items-end gap-3"><div><span className="label-up">Filtered total · {result.count} expenses</span><p data-testid="expenses-running-total" className="text-4xl font-bold font-mono-num">{loading || error ? "—" : money(result.total)}</p></div>
      <button data-testid="expenses-add-manual" className="btn-elev" onClick={() => openReceipt({ manual: true })}>Add manually</button></div>
    {error && <div role="alert" data-testid="expenses-error"><p>{error}</p><button data-testid="expenses-retry" className="btn-elev mt-2" onClick={() => setRetry((n) => n + 1)}>Retry</button></div>}
    {loading ? <p data-testid="expenses-loading" className="text-[#A39990]">Loading expenses…</p> : !error && <ExpenseList expenses={result.items} showJob />}
  </div>;
}
