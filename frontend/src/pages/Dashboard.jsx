import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { money, STATUSES } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import { MapPin, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState({ open_estimates: 0, approved_work: 0, unbilled_expenses: 0, profit_month: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [j, s] = await Promise.all([api.get("/jobs"), api.get("/dashboard/summary")]);
        setJobs(j.data);
        setSummary(s.data);
      } catch (e) {
        toast.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = jobs.filter((j) => j.status === s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-industrial text-3xl font-black uppercase tracking-wider">Board</h1>
        <button
          data-testid="create-job-button"
          onClick={() => navigate("/jobs?new=1")}
          className="tap-min px-4 bg-[#FF5F15] hover:bg-[#E64F0A] text-white text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New job
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatTile testid="stat-open-estimates" label="Open Estimates" value={summary.open_estimates} />
        <StatTile testid="stat-approved-work" label="Approved Work" value={summary.approved_work} accent />
        <StatTile testid="stat-unbilled-expenses" label="Unbilled Expenses" value={summary.unbilled_expenses} warn />
        <StatTile testid="stat-profit-month" label="Profit This Month" value={summary.profit_month} success />
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading jobs…</p>}

      {STATUSES.map((s) => {
        const list = grouped[s];
        if (!list.length) return null;
        return (
          <section key={s} data-testid={`status-group-${s.toLowerCase().replace(" ", "-")}`}>
            <div className="flex items-center gap-3 mb-2.5">
              <StatusBadge status={s} />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">{list.length}</span>
            </div>
            <div className="space-y-2.5">
              {list.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          </section>
        );
      })}

      {!loading && jobs.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="font-mono text-sm">No jobs yet.</p>
          <Link to="/jobs?new=1" className="text-[#FF5F15] font-bold uppercase tracking-wider text-sm">
            Create your first job →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accent, warn, success, testid }) {
  const color = accent
    ? "text-[#FF5F15]"
    : warn
    ? "text-amber-400"
    : success
    ? "text-emerald-400"
    : "text-white";
  return (
    <div className="bg-[#131B26] border border-[#223147] rounded-md p-3">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1.5">{label}</div>
      <div data-testid={testid + "-amount"} className={`money-hero text-2xl md:text-3xl ${color}`}>
        {money(value)}
      </div>
    </div>
  );
}

function JobCard({ job }) {
  const profitPos = job.profit >= 0;
  return (
    <Link
      to={`/jobs/${job.id}`}
      data-testid={`job-card-${job.id}`}
      className="block bg-[#131B26] border border-[#223147] hover:border-[#324866] active:border-[#FF5F15] rounded-md p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Job #{String(job.job_number).padStart(4, "0")}
          </div>
          <div className="font-industrial text-lg font-bold uppercase tracking-wide leading-tight">
            {job.title}
          </div>
          <div className="text-sm text-slate-300 mt-0.5">{job.client?.name || "—"}</div>
          {job.address && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <MapPin className="w-3 h-3" />
              <span className="font-mono">{job.address}</span>
            </div>
          )}
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#223147]">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Contract</div>
          <div data-testid="job-contract-total" className="money-hero text-lg text-white">
            {money(job.contract_total)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Costs</div>
          <div className="money-hero text-lg text-slate-300">{money(job.costs_to_date)}</div>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Profit</div>
          <div className={`money-hero text-lg ${profitPos ? "text-emerald-400" : "text-red-400"}`}>
            {money(job.profit)}
          </div>
          <div className={`text-[10px] font-mono ${profitPos ? "text-emerald-500" : "text-red-500"}`}>
            {job.profit_pct}%
          </div>
        </div>
      </div>
    </Link>
  );
}
