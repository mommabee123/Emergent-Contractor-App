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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-industrial text-3xl font-black uppercase tracking-wider">Clients</h1>
        <button
          data-testid="new-client-button"
          onClick={() => setShowNew(true)}
          className="tap-min px-4 bg-[#FF5F15] text-white text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {showNew && (
        <form onSubmit={submit} className="bg-[#131B26] border border-[#223147] rounded-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-industrial text-lg font-bold uppercase tracking-wider">New client</h2>
            <button type="button" onClick={() => setShowNew(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          {["name", "phone", "email", "address"].map((k) => (
            <input
              key={k}
              required={k === "name"}
              data-testid={`client-${k}-input`}
              placeholder={k[0].toUpperCase() + k.slice(1)}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="w-full tap-min bg-[#080B10] border border-[#324866] text-white px-3 rounded-md outline-none focus:border-[#FF5F15]"
            />
          ))}
          <textarea
            rows={2}
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-[#080B10] border border-[#324866] text-white px-3 py-2 rounded-md outline-none focus:border-[#FF5F15]"
          />
          <button
            data-testid="submit-client-button"
            className="w-full tap-min bg-[#FF5F15] hover:bg-[#E64F0A] text-white font-bold uppercase tracking-wider rounded-md"
          >
            Create client
          </button>
        </form>
      )}

      <div className="space-y-2">
        {clients.map((c) => (
          <Link
            key={c.id}
            to={`/clients/${c.id}`}
            data-testid={`client-row-${c.id}`}
            className="block bg-[#131B26] border border-[#223147] hover:border-[#324866] rounded-md p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-industrial text-lg font-bold uppercase tracking-wide">{c.name}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">{c.address}</div>
              </div>
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="tap-min px-3 text-[#FF5F15] flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                >
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
            </div>
          </Link>
        ))}
        {clients.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No clients yet.</p>}
      </div>
    </div>
  );
}
