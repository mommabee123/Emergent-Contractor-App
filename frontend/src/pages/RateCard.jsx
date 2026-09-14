import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";
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
    <div className="space-y-4">
      <div>
        <h1 className="font-industrial text-3xl font-black uppercase tracking-wider">Rate card</h1>
        <p className="text-xs text-slate-400 font-mono mt-1">
          National-average starting points. Tap the check to confirm each one against your own numbers.
        </p>
      </div>

      {unconfirmedCount > 0 && (
        <div className="bg-amber-950/40 border border-amber-700/40 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5" />
          <div className="text-xs text-amber-200">
            <span className="font-bold">{unconfirmedCount}</span> item{unconfirmedCount !== 1 && "s"} still unconfirmed. Tap the check to mark reviewed.
          </div>
        </div>
      )}

      <form onSubmit={add} className="bg-[#131B26] border border-[#223147] rounded-md p-3">
        <div className="grid grid-cols-12 gap-2">
          <input
            required
            placeholder="Item name"
            data-testid="new-rate-name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            className="col-span-12 md:col-span-5 tap-min bg-[#080B10] border border-[#324866] text-white px-2.5 rounded-md text-sm"
          />
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            className="col-span-4 md:col-span-2 tap-min bg-[#080B10] border border-[#324866] text-white px-2 rounded-md text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={newItem.unit}
            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
            className="col-span-4 md:col-span-2 tap-min bg-[#080B10] border border-[#324866] text-white px-2 rounded-md text-sm"
          >
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
            className="col-span-4 md:col-span-2 tap-min bg-[#080B10] border border-[#324866] text-white px-2 rounded-md text-sm font-mono-num"
          />
          <button
            data-testid="add-rate-button"
            className="col-span-12 md:col-span-1 tap-min bg-[#FF5F15] hover:bg-[#E64F0A] text-white rounded-md flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>

      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h2 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-1.5">{cat}</h2>
          <div className="space-y-1.5">
            {byCat[cat].map((it) => (
              <div
                key={it.id}
                data-testid={`rate-row-${it.id}`}
                className={`bg-[#131B26] border rounded-md p-2 ${
                  it.confirmed ? "border-[#223147]" : "border-amber-800/50"
                }`}
              >
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={it.name}
                    onChange={(e) => update(it.id, { name: e.target.value })}
                    className="col-span-12 md:col-span-6 tap-min bg-transparent border border-transparent hover:border-[#324866] focus:border-[#FF5F15] text-white text-sm px-2 rounded outline-none"
                  />
                  <select
                    value={it.unit}
                    onChange={(e) => update(it.id, { unit: e.target.value })}
                    className="col-span-4 md:col-span-2 tap-min bg-transparent border border-transparent hover:border-[#324866] text-slate-300 text-xs px-1 rounded"
                  >
                    {UNITS.map((u) => (
                      <option key={u} className="bg-[#131B26]">
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
                    className="col-span-5 md:col-span-2 tap-min bg-[#080B10] border border-[#324866] focus:border-[#FF5F15] text-white font-mono-num text-sm px-2 rounded outline-none text-right"
                  />
                  <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => update(it.id, { confirmed: !it.confirmed })}
                      data-testid={`rate-confirm-${it.id}`}
                      className={`tap-min w-10 flex items-center justify-center rounded ${
                        it.confirmed ? "text-emerald-400" : "text-slate-600 hover:text-slate-300"
                      }`}
                      title={it.confirmed ? "Confirmed" : "Confirm price"}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(it.id)}
                      className="tap-min w-10 flex items-center justify-center text-slate-500 hover:text-red-400"
                    >
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
