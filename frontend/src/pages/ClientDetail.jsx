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

  if (!c) return <p className="text-[#6E675F] text-sm">Loading…</p>;

  const lifetimeRevenue = c.jobs.filter((j) => j.status === "Paid").reduce((s, j) => s + (j.contract_total || 0), 0);

  return (
    <div className="space-y-6">
      <Link to="/clients" className="text-xs uppercase tracking-widest" style={{ color: "var(--blue)" }}>
        ← Clients
      </Link>

      <div className="surface-card">
        <h1 className="font-industrial text-2xl font-bold uppercase tracking-wide">{c.name}</h1>
        <div className="space-y-2 mt-3 text-[15px]">
          {c.phone && (
            <a href={`tel:${c.phone}`} className="flex items-center gap-2" style={{ color: "var(--blue)" }}>
              <Phone className="w-4 h-4" /> {c.phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex items-center gap-2" style={{ color: "var(--blue)" }}>
              <Mail className="w-4 h-4" /> {c.email}
            </a>
          )}
          {c.address && (
            <div className="flex items-center gap-2 text-[#A39990]">
              <MapPin className="w-4 h-4" /> {c.address}
            </div>
          )}
        </div>
        {c.notes && <p className="text-sm text-[#A39990] mt-4 pt-4 border-t border-[#2B2823]">{c.notes}</p>}
      </div>

      <div>
        <div className="label-up mb-1">Lifetime revenue (paid)</div>
        <div data-testid="client-lifetime-revenue" className="font-mono-num font-extrabold text-[#F0EAE2]" style={{ fontSize: 34 }}>
          {money(lifetimeRevenue)}
        </div>
      </div>

      <div>
        <h2 className="font-industrial text-lg font-bold uppercase tracking-wider mb-3">Job history</h2>
        <div className="space-y-3">
          {c.jobs.map((j) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="block surface-card hover:border-[#3a352e]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-[#6E675F]">
                    #{String(j.job_number).padStart(4, "0")} · {usDate(j.created_at)}
                  </div>
                  <div className="font-bold text-[#F0EAE2] truncate mt-0.5">{j.title}</div>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={j.status} />
                  <div className="font-mono-num font-bold text-[#F0EAE2] mt-1.5">{money(j.contract_total || 0)}</div>
                </div>
              </div>
            </Link>
          ))}
          {c.jobs.length === 0 && <p className="text-[#6E675F] text-sm">No jobs yet.</p>}
        </div>
      </div>
    </div>
  );
}
