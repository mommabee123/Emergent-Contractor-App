import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { money, usDate } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import { Phone, Mail, MapPin } from "lucide-react";

export default function ClientDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/clients/${id}`);
      // fetch job totals
      const jobsWithTotals = await Promise.all(
        data.jobs.map(async (j) => {
          try {
            const { data: full } = await api.get(`/jobs/${j.id}`);
            return { ...j, contract_total: full.contract_total };
          } catch {
            return j;
          }
        })
      );
      setC({ ...data, jobs: jobsWithTotals });
    })();
  }, [id]);

  if (!c) return <p className="text-slate-500 text-sm">Loading…</p>;

  const lifetimeRevenue = c.jobs.filter((j) => j.status === "Paid").reduce((s, j) => s + (j.contract_total || 0), 0);

  return (
    <div className="space-y-4">
      <Link to="/clients" className="text-xs font-mono uppercase tracking-widest text-slate-500 hover:text-white">
        ← Clients
      </Link>

      <div className="bg-[#131B26] border border-[#223147] rounded-md p-4">
        <h1 className="font-industrial text-2xl font-black uppercase tracking-wide">{c.name}</h1>
        <div className="space-y-1.5 mt-2 text-sm">
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-[#FF5F15]">
              <Phone className="w-4 h-4" /> {c.phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-slate-300">
              <Mail className="w-4 h-4" /> {c.email}
            </a>
          )}
          {c.address && (
            <div className="flex items-center gap-2 text-slate-300 font-mono text-xs">
              <MapPin className="w-4 h-4" /> {c.address}
            </div>
          )}
        </div>
        {c.notes && <p className="text-sm text-slate-400 mt-3 border-t border-[#223147] pt-3">{c.notes}</p>}
      </div>

      <div className="bg-[#131B26] border border-[#223147] rounded-md p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Lifetime revenue (paid)</div>
        <div data-testid="client-lifetime-revenue" className="money-hero text-4xl text-[#FF5F15]">
          {money(lifetimeRevenue)}
        </div>
      </div>

      <div>
        <h2 className="font-industrial text-lg font-bold uppercase tracking-wider mb-2">Job history</h2>
        <div className="space-y-2">
          {c.jobs.map((j) => (
            <Link
              key={j.id}
              to={`/jobs/${j.id}`}
              className="block bg-[#131B26] border border-[#223147] hover:border-[#324866] rounded-md p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-slate-500">
                    #{String(j.job_number).padStart(4, "0")} · {usDate(j.created_at)}
                  </div>
                  <div className="font-bold text-white truncate">{j.title}</div>
                </div>
                <div className="text-right">
                  <StatusBadge status={j.status} />
                  <div className="money-hero text-base text-white mt-1">{money(j.contract_total || 0)}</div>
                </div>
              </div>
            </Link>
          ))}
          {c.jobs.length === 0 && <p className="text-slate-500 text-sm">No jobs yet.</p>}
        </div>
      </div>
    </div>
  );
}
