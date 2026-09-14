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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-industrial text-3xl font-black uppercase tracking-wider">Jobs</h1>
        <button
          data-testid="new-job-button"
          onClick={() => setShowNew(true)}
          className="tap-min px-4 bg-[#FF5F15] text-white text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {showNew && (
        <form
          onSubmit={create}
          data-testid="new-job-form"
          className="bg-[#131B26] border border-[#223147] rounded-md p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-industrial text-lg font-bold uppercase tracking-wider">New job</h2>
            <button type="button" onClick={() => setShowNew(false)} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <Field label="Title">
            <input
              required
              data-testid="new-job-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Client">
            <select
              data-testid="new-job-client"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className={inputCls}
              required
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Site address">
            <input
              data-testid="new-job-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={inputCls}
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className={inputCls + " py-2"}
            />
          </Field>
          <button
            data-testid="new-job-submit"
            className="w-full tap-min bg-[#FF5F15] hover:bg-[#E64F0A] text-white font-bold uppercase tracking-wider rounded-md"
          >
            Create job
          </button>
        </form>
      )}

      <div className="space-y-2.5">
        {jobs.map((j) => (
          <Link
            key={j.id}
            to={`/jobs/${j.id}`}
            data-testid={`jobs-list-item-${j.id}`}
            className="block bg-[#131B26] border border-[#223147] hover:border-[#324866] rounded-md p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Job #{String(j.job_number).padStart(4, "0")}
                </div>
                <div className="font-industrial text-lg font-bold uppercase tracking-wide">{j.title}</div>
                <div className="text-sm text-slate-300">{j.client?.name}</div>
              </div>
              <div className="text-right">
                <StatusBadge status={j.status} />
                <div className="money-hero text-xl text-white mt-1.5">{money(j.contract_total)}</div>
              </div>
            </div>
          </Link>
        ))}
        {jobs.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No jobs.</p>}
      </div>
    </div>
  );
}

const inputCls =
  "w-full tap-min bg-[#080B10] border border-[#324866] focus:border-[#FF5F15] focus:ring-1 focus:ring-[#FF5F15] text-white text-base px-3.5 rounded-md outline-none";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
