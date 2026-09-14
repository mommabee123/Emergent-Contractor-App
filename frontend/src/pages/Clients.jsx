import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Plus, X, Phone } from "lucide-react";
import { toast } from "sonner";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  const load = async () => {
    const { data } = await api.get("/clients");
    setClients(data);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/clients", form);
      toast.success("Client added");
      setShowNew(false);
      setForm({ name: "", phone: "", email: "", address: "", notes: "" });
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-industrial text-3xl font-bold uppercase tracking-wider">Clients</h1>
        <button data-testid="new-client-button" onClick={() => setShowNew(true)} className="btn-bone tap-min px-4 text-xs">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {showNew && (
        <form onSubmit={submit} className="surface-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-industrial text-lg font-bold uppercase tracking-wider">New client</h2>
            <button type="button" onClick={() => setShowNew(false)} className="p-2 text-[#A39990] hover:text-[#F0EAE2]">
              <X className="w-5 h-5" />
            </button>
          </div>
          {["name", "phone", "email", "address"].map((k) => (
            <div key={k}>
              <label className="label-up">{k[0].toUpperCase() + k.slice(1)}</label>
              <input
                required={k === "name"}
                data-testid={`client-${k}-input`}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="input-field"
              />
            </div>
          ))}
          <div>
            <label className="label-up">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field py-3" />
          </div>
          <button data-testid="submit-client-button" className="btn-bone w-full">
            Create client
          </button>
        </form>
      )}

      <div className="space-y-3">
        {clients.map((c) => (
          <Link key={c.id} to={`/clients/${c.id}`} data-testid={`client-row-${c.id}`} className="block surface-card hover:border-[#3a352e]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[17px] font-bold text-[#F0EAE2]">{c.name}</div>
                <div className="text-sm text-[#A39990] mt-0.5 truncate">{c.address}</div>
              </div>
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="tap-min px-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                  style={{ color: "var(--blue)" }}
                >
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
            </div>
          </Link>
        ))}
        {clients.length === 0 && <p className="text-[#6E675F] text-sm text-center py-12">No clients yet.</p>}
      </div>
    </div>
  );
}
