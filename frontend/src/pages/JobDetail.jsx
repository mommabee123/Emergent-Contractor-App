import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { money, usDate, STATUSES } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import AuthImage from "../components/AuthImage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Phone, MapPin, Plus, Trash2, Camera, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);

  const load = async () => {
    const [j, r] = await Promise.all([api.get(`/jobs/${id}`), api.get("/rate-card")]);
    setJob(j.data);
    setRates(r.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const changeStatus = async (s) => {
    setStatusOpen(false);
    try {
      await api.put(`/jobs/${id}`, {
        title: job.title,
        client_id: job.client_id,
        address: job.address,
        status: s,
        start_date: job.start_date,
        notes: job.notes,
        cover_photo_id: job.cover_photo_id,
      });
      toast.success("Status updated");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  if (loading || !job) return <p className="text-slate-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-4">
      <Link to="/" className="text-xs font-mono uppercase tracking-widest text-slate-500 hover:text-white">
        ← Board
      </Link>

      <header className="bg-[#131B26] border border-[#223147] rounded-md p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Job #{String(job.job_number).padStart(4, "0")} · Started {usDate(job.start_date)}
            </div>
            <h1 className="font-industrial text-2xl font-black uppercase tracking-wide leading-tight mt-0.5">
              {job.title}
            </h1>
            <div className="text-slate-300 mt-1">{job.client?.name}</div>
            {job.address && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-mono">
                <MapPin className="w-3.5 h-3.5" /> {job.address}
              </div>
            )}
            {job.client?.phone && (
              <a
                href={`tel:${job.client.phone}`}
                data-testid="client-call-button"
                className="inline-flex items-center gap-1.5 mt-2 text-[#FF5F15] font-bold text-xs uppercase tracking-wider"
              >
                <Phone className="w-3.5 h-3.5" /> {job.client.phone}
              </a>
            )}
          </div>

          <div className="relative">
            <button
              data-testid="status-picker"
              onClick={() => setStatusOpen(!statusOpen)}
              className="flex items-center gap-1"
            >
              <StatusBadge status={job.status} />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-[#1A2433] border border-[#324866] rounded-md min-w-[160px] overflow-hidden">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    data-testid={`status-option-${s}`}
                    className="w-full text-left px-3 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-[#223147]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#223147]">
          <MetricPill label="Contract" value={money(job.contract_total)} accent testid="job-contract" />
          <MetricPill label="Costs" value={money(job.costs_to_date)} testid="job-costs" />
          <MetricPill
            label="Profit"
            value={money(job.profit)}
            sub={`${job.profit_pct}%`}
            success={job.profit >= 0}
            danger={job.profit < 0}
            testid="job-profit"
          />
        </div>
      </header>

      <Tabs defaultValue="estimate">
        <TabsList className="w-full grid grid-cols-3 bg-[#080B10] border border-[#223147] p-1 h-auto">
          <TabsTrigger
            value="estimate"
            data-testid="tab-estimate-trigger"
            className="min-h-[44px] font-industrial text-sm font-bold uppercase tracking-wider data-[state=active]:bg-[#1A2433] data-[state=active]:text-[#FF5F15]"
          >
            Estimate
          </TabsTrigger>
          <TabsTrigger
            value="log"
            data-testid="tab-log-trigger"
            className="min-h-[44px] font-industrial text-sm font-bold uppercase tracking-wider data-[state=active]:bg-[#1A2433] data-[state=active]:text-[#FF5F15]"
          >
            Log
          </TabsTrigger>
          <TabsTrigger
            value="expenses"
            data-testid="tab-expenses-trigger"
            className="min-h-[44px] font-industrial text-sm font-bold uppercase tracking-wider data-[state=active]:bg-[#1A2433] data-[state=active]:text-[#FF5F15]"
          >
            Expenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="estimate" className="mt-4">
          <EstimateTab jobId={id} initial={job.estimate} rates={rates} onSaved={load} />
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <LogTab jobId={id} logs={job.logs} hours={job.hours} onChange={load} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab jobId={id} expenses={job.expenses} onChange={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricPill({ label, value, sub, accent, success, danger, testid }) {
  const color = accent ? "text-[#FF5F15]" : success ? "text-emerald-400" : danger ? "text-red-400" : "text-white";
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">{label}</div>
      <div data-testid={testid} className={`money-hero text-xl md:text-2xl ${color}`}>
        {value}
      </div>
      {sub && <div className={`text-[10px] font-mono ${color}`}>{sub}</div>}
    </div>
  );
}

function EstimateTab({ jobId, initial, rates, onSaved }) {
  const [items, setItems] = useState(initial?.line_items || []);
  const [taxRate, setTaxRate] = useState(initial?.tax_rate ?? 0);
  const [status, setStatus] = useState(initial?.status || "draft");
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
  const tax = subtotal * (Number(taxRate) / 100);
  const total = subtotal + tax;

  const addFromRate = (rateId) => {
    const r = rates.find((x) => x.id === rateId);
    if (!r) return;
    setItems([...items, { description: r.name, quantity: 1, unit: r.unit, unit_price: r.unit_price, line_total: r.unit_price }]);
  };

  const addBlank = () => setItems([...items, { description: "", quantity: 1, unit: "each", unit_price: 0, line_total: 0 }]);

  const update = (idx, field, val) => {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: val };
    setItems(copy);
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/jobs/${jobId}/estimate`, { line_items: items, tax_rate: Number(taxRate), status, notes: "" });
      toast.success("Estimate saved");
      onSaved();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          data-testid="estimate-add-from-rate"
          onChange={(e) => {
            if (e.target.value) {
              addFromRate(e.target.value);
              e.target.value = "";
            }
          }}
          className="flex-1 tap-min bg-[#080B10] border border-[#324866] text-white text-sm px-3 rounded-md"
        >
          <option value="">+ Add from rate card…</option>
          {rates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · ${r.unit_price}/{r.unit}
            </option>
          ))}
        </select>
        <button
          onClick={addBlank}
          data-testid="add-line-item-button"
          className="tap-min px-3 bg-[#1A2433] border border-[#324866] text-white rounded-md flex items-center"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => {
          const lt = Number(it.quantity || 0) * Number(it.unit_price || 0);
          return (
            <div
              key={idx}
              data-testid={`estimate-line-${idx}`}
              className="bg-[#131B26] border border-[#223147] rounded-md p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <input
                  value={it.description}
                  onChange={(e) => update(idx, "description", e.target.value)}
                  placeholder="Description"
                  className="flex-1 bg-[#080B10] border border-[#324866] text-white text-sm px-2.5 py-2 rounded-md outline-none focus:border-[#FF5F15]"
                />
                <button onClick={() => removeItem(idx)} className="p-2 text-slate-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={it.quantity}
                  onChange={(e) => update(idx, "quantity", e.target.value)}
                  placeholder="Qty"
                  className="tap-min bg-[#080B10] border border-[#324866] text-white text-base font-mono-num px-2 rounded-md outline-none focus:border-[#FF5F15]"
                />
                <input
                  value={it.unit}
                  onChange={(e) => update(idx, "unit", e.target.value)}
                  className="tap-min bg-[#080B10] border border-[#324866] text-white text-sm px-2 rounded-md outline-none focus:border-[#FF5F15]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={it.unit_price}
                  onChange={(e) => update(idx, "unit_price", e.target.value)}
                  placeholder="$"
                  className="tap-min bg-[#080B10] border border-[#324866] text-white text-base font-mono-num px-2 rounded-md outline-none focus:border-[#FF5F15]"
                />
                <div className="tap-min flex items-center justify-end font-mono-num text-white font-bold">
                  {money(lt)}
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-slate-500 text-sm text-center py-6">No line items yet.</p>}
      </div>

      <div className="bg-[#131B26] border border-[#223147] rounded-md p-4 space-y-3">
        <Row label="Subtotal" value={money(subtotal)} />
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Tax rate %</label>
          <input
            type="number"
            step="0.01"
            data-testid="estimate-tax-rate"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="w-24 tap-min bg-[#080B10] border border-[#324866] text-white text-base font-mono-num px-2.5 rounded-md text-right outline-none focus:border-[#FF5F15]"
          />
        </div>
        <Row label="Tax" value={money(tax)} />
        <div className="pt-3 border-t border-[#223147]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Grand total</div>
          <div data-testid="estimate-grand-total" className="money-hero text-4xl text-[#FF5F15]">
            {money(total)}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-testid="estimate-status"
          className="flex-1 tap-min bg-[#080B10] border border-[#324866] text-white text-sm px-3 rounded-md"
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
        </select>
        <button
          onClick={save}
          disabled={saving}
          data-testid="save-estimate-button"
          className="tap-min px-6 bg-[#FF5F15] hover:bg-[#E64F0A] text-white font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">{label}</span>
      <span className="font-mono-num text-white text-lg font-bold">{value}</span>
    </div>
  );
}

function LogTab({ jobId, logs, hours, onChange }) {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [photoIds, setPhotoIds] = useState([]);
  const [hoursForm, setHoursForm] = useState({ date: new Date().toISOString().slice(0, 10), person: "", hours: "", hourly_rate: "" });
  const fileRef = useRef(null);

  const uploadPhoto = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    return data.id;
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const id = await uploadPhoto(file);
      setPhotoIds([...photoIds, id]);
      toast.success("Photo added");
    } catch {
      toast.error("Upload failed");
    }
  };

  const addLog = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/jobs/${jobId}/log`, { date, note, photo_ids: photoIds });
      setNote("");
      setPhotoIds([]);
      toast.success("Log added");
      onChange();
    } catch {
      toast.error("Failed");
    }
  };

  const addHours = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/jobs/${jobId}/hours`, {
        date: hoursForm.date,
        person: hoursForm.person,
        hours: Number(hoursForm.hours),
        hourly_rate: Number(hoursForm.hourly_rate),
      });
      setHoursForm({ ...hoursForm, person: "", hours: "", hourly_rate: "" });
      toast.success("Hours added");
      onChange();
    } catch {
      toast.error("Failed");
    }
  };

  const delLog = async (lid) => {
    await api.delete(`/log/${lid}`);
    onChange();
  };

  const delHours = async (hid) => {
    await api.delete(`/hours/${hid}`);
    onChange();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={addLog} className="bg-[#131B26] border border-[#223147] rounded-md p-4 space-y-3">
        <h3 className="font-industrial text-sm font-bold uppercase tracking-wider text-slate-300">Field log entry</h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="log-date"
          className="w-full tap-min bg-[#080B10] border border-[#324866] text-white px-3 rounded-md"
        />
        <textarea
          required
          data-testid="log-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What happened today?"
          className="w-full bg-[#080B10] border border-[#324866] text-white px-3 py-2.5 rounded-md outline-none focus:border-[#FF5F15]"
        />
        {photoIds.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {photoIds.map((pid) => (
              <AuthImage key={pid} fileId={pid} className="w-16 h-16 object-cover rounded border border-[#324866]" />
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickPhoto} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="log-add-photo"
            className="tap-min px-4 bg-[#1A2433] border border-[#324866] text-slate-100 text-sm font-semibold uppercase tracking-wide rounded-md flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4" /> Photo
          </button>
          <button
            data-testid="add-log-button"
            className="flex-1 tap-min bg-[#FF5F15] hover:bg-[#E64F0A] text-white font-bold uppercase tracking-wider rounded-md"
          >
            Add log
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {logs.map((l) => (
          <div key={l.id} data-testid={`log-item-${l.id}`} className="bg-[#131B26] border border-[#223147] rounded-md p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{usDate(l.date)}</div>
              <button onClick={() => delLog(l.id)} className="text-slate-500 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-slate-200 mt-1 whitespace-pre-wrap">{l.note}</p>
            {l.photo_ids?.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {l.photo_ids.map((pid) => (
                  <AuthImage key={pid} fileId={pid} className="w-20 h-20 object-cover rounded border border-[#324866]" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <details className="bg-[#131B26] border border-[#223147] rounded-md">
        <summary className="cursor-pointer p-4 font-industrial text-sm font-bold uppercase tracking-wider text-slate-300">
          Crew hours ({hours.length})
        </summary>
        <div className="p-4 pt-0 space-y-3">
          <form onSubmit={addHours} className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={hoursForm.date}
              onChange={(e) => setHoursForm({ ...hoursForm, date: e.target.value })}
              className="tap-min bg-[#080B10] border border-[#324866] text-white px-2 rounded-md text-sm"
            />
            <input
              required
              placeholder="Person"
              value={hoursForm.person}
              onChange={(e) => setHoursForm({ ...hoursForm, person: e.target.value })}
              className="tap-min bg-[#080B10] border border-[#324866] text-white px-2 rounded-md text-sm"
            />
            <input
              required
              type="number"
              step="0.25"
              placeholder="Hours"
              value={hoursForm.hours}
              onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })}
              className="tap-min bg-[#080B10] border border-[#324866] text-white px-2 font-mono-num rounded-md text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="Rate $"
              value={hoursForm.hourly_rate}
              onChange={(e) => setHoursForm({ ...hoursForm, hourly_rate: e.target.value })}
              className="tap-min bg-[#080B10] border border-[#324866] text-white px-2 font-mono-num rounded-md text-sm"
            />
            <button className="col-span-2 tap-min bg-[#FF5F15] text-white font-bold uppercase tracking-wider rounded-md text-sm">
              Add hours
            </button>
          </form>
          <div className="space-y-1.5">
            {hours.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm bg-[#080B10] rounded p-2">
                <span className="text-slate-300">
                  {usDate(h.date)} · {h.person}
                </span>
                <span className="font-mono-num text-white">
                  {h.hours}h × {money(h.hourly_rate)} = {money(h.hours * h.hourly_rate)}
                </span>
                <button onClick={() => delHours(h.id)} className="text-slate-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

function ExpensesTab({ jobId, expenses, onChange }) {
  const [form, setForm] = useState({
    vendor: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "material",
    description: "",
    receipt_photo_id: null,
  });
  const fileRef = useRef(null);

  const totalCost = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const onPickReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm({ ...form, receipt_photo_id: data.id });
      toast.success("Receipt attached");
    } catch {
      toast.error("Upload failed");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/jobs/${jobId}/expenses`, { ...form, amount: Number(form.amount) });
      setForm({
        vendor: "",
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        category: "material",
        description: "",
        receipt_photo_id: null,
      });
      toast.success("Expense added");
      onChange();
    } catch {
      toast.error("Failed");
    }
  };

  const del = async (id) => {
    await api.delete(`/expenses/${id}`);
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#131B26] border border-[#223147] rounded-md p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Total job costs</div>
        <div data-testid="expenses-total" className="money-hero text-4xl text-white">
          {money(totalCost)}
        </div>
      </div>

      <form onSubmit={submit} className="bg-[#131B26] border border-[#223147] rounded-md p-4 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            placeholder="Vendor"
            data-testid="expense-vendor"
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            className="tap-min bg-[#080B10] border border-[#324866] text-white px-2.5 rounded-md text-sm"
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="tap-min bg-[#080B10] border border-[#324866] text-white px-2.5 rounded-md text-sm"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Amount"
            data-testid="expense-amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="tap-min bg-[#080B10] border border-[#324866] text-white px-2.5 font-mono-num rounded-md text-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="tap-min bg-[#080B10] border border-[#324866] text-white px-2.5 rounded-md text-sm"
          >
            <option value="material">Material</option>
            <option value="labor">Labor</option>
            <option value="equipment">Equipment</option>
            <option value="disposal">Disposal</option>
          </select>
        </div>
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full tap-min bg-[#080B10] border border-[#324866] text-white px-2.5 rounded-md text-sm"
        />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickReceipt} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap-min px-3 bg-[#1A2433] border border-[#324866] text-slate-100 text-sm rounded-md flex items-center gap-1.5"
          >
            <Camera className="w-4 h-4" />
            {form.receipt_photo_id ? "Attached" : "Receipt"}
          </button>
          <button
            data-testid="add-expense-button"
            className="flex-1 tap-min bg-[#FF5F15] hover:bg-[#E64F0A] text-white font-bold uppercase tracking-wider rounded-md"
          >
            Add expense
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {expenses.map((e) => (
          <div
            key={e.id}
            data-testid={`expense-item-${e.id}`}
            className="bg-[#131B26] border border-[#223147] rounded-md p-3 flex items-start gap-3"
          >
            {e.receipt_photo_id && (
              <AuthImage fileId={e.receipt_photo_id} className="w-14 h-14 object-cover rounded border border-[#324866]" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-bold text-white truncate">{e.vendor}</div>
                <div className="money-hero text-lg text-white">{money(e.amount)}</div>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                {usDate(e.date)} · {e.category}
              </div>
              {e.description && <div className="text-xs text-slate-400 mt-0.5">{e.description}</div>}
            </div>
            <button onClick={() => del(e.id)} className="text-slate-500 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
