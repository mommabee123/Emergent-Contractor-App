import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { money, STATUSES } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [params, setParams] = useSearchParams();
  const [showNew, setShowNew] = useState(params.get("new") === "1");
  const [form, setForm] = useState({ title: "", client_id: "", address: "", status: "Lead", notes: "" });

  const load = async () => {
    const [j, c] = await Promise.all([api.get("/jobs"), api.get("/clients")]);
    setJobs(j.data);
    setClients(c.data);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (clients.length && !form.client_id) setForm((f) => ({ ...f, client_id: clients[0].id }));
  }, [clients]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/jobs", form);
      toast.success("Job created");
      setShowNew(false);
      setForm({ title: "", client_id: clients[0]?.id || "", address: "", status: "Lead", notes: "" });
      params.delete("new");
      setParams(params);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-industrial text-3xl font-bold uppercase tracking-wider">Jobs</h1>
        <button data-testid="new-job-button" onClick={() => setShowNew(true)} className="btn-bone tap-min px-4 text-xs">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} data-testid="new-job-form" className="surface-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-industrial text-lg font-bold uppercase tracking-wider">New job</h2>
            <button type="button" onClick={() => setShowNew(false)} className="p-2 text-[#A39990] hover:text-[#F0EAE2]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div>
            <label className="label-up">Title</label>
            <input required data-testid="new-job-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-up">Client</label>
            <select data-testid="new-job-client" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="input-field" required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-up">Site address</label>
            <input data-testid="new-job-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-up">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-up">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input-field py-3" />
          </div>
          <button data-testid="new-job-submit" className="btn-bone w-full">
            Create job
          </button>
        </form>
      )}

      <div className="space-y-3">
        {jobs.map((j) => (
          <Link key={j.id} to={`/jobs/${j.id}`} data-testid={`jobs-list-item-${j.id}`} className="block surface-card hover:border-[#3a352e]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[17px] font-bold text-[#F0EAE2]">{j.client?.name}</div>
                <div className="text-sm text-[#A39990] mt-0.5">{j.title}</div>
                <div className="text-[10px] uppercase tracking-widest text-[#6E675F] mt-1.5">
                  Job #{String(j.job_number).padStart(4, "0")}
                </div>
              </div>
              <div className="text-right shrink-0">
                <StatusBadge status={j.status} />
                <div className="font-mono-num font-bold text-[#F0EAE2] mt-2" style={{ fontSize: 22 }}>
                  {money(j.contract_total)}
                </div>
              </div>
            </div>
          </Link>
        ))}
        {jobs.length === 0 && <p className="text-[#6E675F] text-sm text-center py-12">No jobs.</p>}
      </div>
    </div>
  );
}
