import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const UNITS = ["hour", "sq ft", "linear ft", "each", "day", "square", "gal", "load"];
const CATEGORIES = ["labor", "material", "equipment", "disposal"];

export default function RateCard() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: "", unit: "hour", unit_price: "", category: "labor" });

  const load = async () => {
    const { data } = await api.get("/rate-card");
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id, patch) => {
    const orig = items.find((i) => i.id === id);
    const merged = { ...orig, ...patch };
    setItems(items.map((i) => (i.id === id ? merged : i)));
    try {
      await api.put(`/rate-card/${id}`, {
        name: merged.name,
        unit: merged.unit,
        unit_price: Number(merged.unit_price),
        category: merged.category,
        confirmed: merged.confirmed,
      });
    } catch {
      toast.error("Save failed");
    }
  };

  const remove = async (id) => {
    setItems(items.filter((i) => i.id !== id));
    await api.delete(`/rate-card/${id}`);
    toast.success("Removed");
  };

  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post("/rate-card", {
        name: newItem.name,
        unit: newItem.unit,
        unit_price: Number(newItem.unit_price),
        category: newItem.category,
        confirmed: true,
      });
      setNewItem({ name: "", unit: "hour", unit_price: "", category: "labor" });
      load();
      toast.success("Added");
    } catch {
      toast.error("Failed");
    }
  };

  const byCat = CATEGORIES.reduce((acc, c) => {
    acc[c] = items.filter((i) => i.category === c);
    return acc;
  }, {});
  const unconfirmedCount = items.filter((i) => !i.confirmed).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-industrial text-3xl font-bold uppercase tracking-wider">Rate card</h1>
        <p className="text-sm text-[#A39990] mt-1">
          National-average starting points. Tap the check to confirm each one against your own numbers.
        </p>
      </div>

      {unconfirmedCount > 0 && (
        <div
          className="rounded-lg p-3 flex items-start gap-2 text-sm"
          style={{ background: "rgba(224,162,56,0.1)", border: "1px solid var(--amber)", color: "var(--amber)" }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <b>{unconfirmedCount}</b> item{unconfirmedCount !== 1 && "s"} still unconfirmed. Tap the check to mark reviewed.
          </span>
        </div>
      )}

      <form onSubmit={add} className="surface-card">
        <div className="grid grid-cols-12 gap-2">
          <input
            required
            placeholder="Item name"
            data-testid="new-rate-name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            className="input-field col-span-12 md:col-span-5"
          />
          <select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} className="input-field col-span-4 md:col-span-2">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="input-field col-span-4 md:col-span-2">
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <input
            required
            type="number"
            step="0.01"
            placeholder="$"
            data-testid="new-rate-price"
            value={newItem.unit_price}
            onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
            className="input-field col-span-3 md:col-span-2 font-mono-num"
          />
          <button data-testid="add-rate-button" className="btn-bone col-span-12 md:col-span-1 px-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>

      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h2 className="label-up mb-2">{cat}</h2>
          <div className="space-y-2">
            {byCat[cat].map((it) => (
              <div
                key={it.id}
                data-testid={`rate-row-${it.id}`}
                className="surface-card !p-2.5"
                style={!it.confirmed ? { borderColor: "var(--amber)" } : undefined}
              >
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={it.name}
                    onChange={(e) => update(it.id, { name: e.target.value })}
                    className="col-span-12 md:col-span-6 tap-min bg-transparent border border-transparent hover:border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] text-[15px] px-2 rounded-lg outline-none"
                  />
                  <select
                    value={it.unit}
                    onChange={(e) => update(it.id, { unit: e.target.value })}
                    className="col-span-4 md:col-span-2 tap-min bg-transparent border border-transparent hover:border-[#2B2823] text-[#A39990] text-sm px-1 rounded-lg"
                  >
                    {UNITS.map((u) => (
                      <option key={u} className="bg-[#1C1A17]">
                        {u}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    data-testid={`rate-item-price-input-${it.id}`}
                    value={it.unit_price}
                    onChange={(e) => update(it.id, { unit_price: e.target.value })}
                    className="col-span-5 md:col-span-2 tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] font-mono-num text-sm px-2 rounded-lg outline-none text-right"
                  />
                  <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => update(it.id, { confirmed: !it.confirmed })}
                      data-testid={`rate-confirm-${it.id}`}
                      className="tap-min w-10 flex items-center justify-center rounded-lg"
                      style={{ color: it.confirmed ? "var(--green)" : "#6E675F" }}
                      title={it.confirmed ? "Confirmed" : "Confirm price"}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(it.id)} className="tap-min w-10 flex items-center justify-center text-[#6E675F] hover:text-[#E04838]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
