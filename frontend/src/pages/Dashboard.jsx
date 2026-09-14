import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { money, STATUSES, profitColor } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import { Plus } from "lucide-react";
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
      } catch {
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
    <div className="space-y-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-industrial text-3xl font-bold uppercase tracking-wider">Board</h1>
        <button data-testid="create-job-button" onClick={() => navigate("/jobs?new=1")} className="btn-bone tap-min px-4 text-xs">
          <Plus className="w-4 h-4" /> New job
        </button>
      </div>

      {/* Stat tiles: number large, small uppercase label above, no icons, no borders */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8">
        <StatTile testid="stat-open-estimates" label="Open Estimates" value={summary.open_estimates} />
        <StatTile testid="stat-approved-work" label="Approved Work" value={summary.approved_work} />
        <StatTile testid="stat-unbilled-expenses" label="Unbilled Expenses" value={summary.unbilled_expenses} />
        <StatTile
          testid="stat-profit-month"
          label="Profit This Month"
          value={summary.profit_month}
          color={summary.profit_month >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      {loading && <p className="text-[#6E675F] text-sm">Loading jobs…</p>}

      {STATUSES.map((s) => {
        const list = grouped[s];
        if (!list.length) return null;
        return (
          <section key={s} data-testid={`status-group-${s.toLowerCase().replace(" ", "-")}`}>
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge status={s} />
              <span className="text-xs text-[#6E675F] uppercase tracking-widest">{list.length}</span>
            </div>
            <div className="space-y-3">
              {list.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          </section>
        );
      })}

      {!loading && jobs.length === 0 && (
        <div className="py-16 text-[#6E675F]">
          <p className="text-sm">No jobs yet.</p>
          <Link to="/jobs?new=1" className="font-bold text-sm" style={{ color: "var(--blue)" }}>
            Create your first job →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, color, testid }) {
  return (
    <div>
      <div className="label-up mb-1">{label}</div>
      <div
        data-testid={testid + "-amount"}
        className="font-mono-num font-extrabold"
        style={{ fontSize: 32, lineHeight: 1.1, color: color || "#F0EAE2" }}
      >
        {money(value)}
      </div>
    </div>
  );
}

function JobCard({ job }) {
  const pColor = profitColor(job.profit, job.profit_pct);
  return (
    <Link
      to={`/jobs/${job.id}`}
      data-testid={`job-card-${job.id}`}
      className="block surface-card hover:border-[#3a352e] active:border-[#2F7DE1] transition-colors"
    >
      {/* client name, then address, then money, then status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[17px] font-bold text-[#F0EAE2] leading-tight">{job.client?.name || "—"}</div>
          <div className="text-sm text-[#A39990] mt-0.5">{job.title}</div>
          {job.address && <div className="text-xs text-[#6E675F] mt-1">{job.address}</div>}
          <div className="text-[10px] uppercase tracking-widest text-[#6E675F] mt-1.5">
            Job #{String(job.job_number).padStart(4, "0")}
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#2B2823]">
        <div>
          <div className="label-up mb-1">Contract</div>
          <div data-testid="job-contract-total" className="font-mono-num font-bold text-[#F0EAE2]" style={{ fontSize: 24 }}>
            {money(job.contract_total)}
          </div>
        </div>
        <div>
          <div className="label-up mb-1">Costs</div>
          <div className="font-mono-num font-bold text-[#A39990]" style={{ fontSize: 24 }}>
            {money(job.costs_to_date)}
          </div>
        </div>
        <div>
          <div className="label-up mb-1">Profit</div>
          <div className="font-mono-num font-bold" style={{ fontSize: 24, color: pColor }}>
            {money(job.profit)}
          </div>
          <div className="text-[11px] font-mono-num" style={{ color: pColor }}>
            {job.profit_pct}%
          </div>
        </div>
      </div>
    </Link>
  );
}
