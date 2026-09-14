import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { money, usDate, STATUSES, profitColor } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";
import AuthImage from "../components/AuthImage";
import PhotoEstimate from "../components/PhotoEstimate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Phone, MapPin, Plus, Trash2, Camera, ChevronDown, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const inputCls = "input-field";

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusOpen, setStatusOpen] = useState(false);
  const [photoFlowOpen, setPhotoFlowOpen] = useState(false);

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

  if (loading || !job) return <p className="text-[#6E675F] text-sm">Loading…</p>;

  const pColor = profitColor(job.profit, job.profit_pct);

  return (
    <div className="space-y-6">
      <Link to="/" className="text-xs uppercase tracking-widest" style={{ color: "var(--blue)" }}>
        ← Board
      </Link>

      <header className="surface-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-[#6E675F]">
              Job #{String(job.job_number).padStart(4, "0")} · Started {usDate(job.start_date)}
            </div>
            <div className="text-[19px] font-bold text-[#F0EAE2] leading-tight mt-1">{job.client?.name}</div>
            <h1 className="text-[15px] text-[#A39990] mt-0.5">{job.title}</h1>
            {job.address && (
              <div className="flex items-center gap-1.5 text-xs text-[#6E675F] mt-1.5">
                <MapPin className="w-3.5 h-3.5" /> {job.address}
              </div>
            )}
            {job.client?.phone && (
              <a
                href={`tel:${job.client.phone}`}
                data-testid="client-call-button"
                className="inline-flex items-center gap-1.5 mt-2 font-bold text-xs uppercase tracking-wider"
                style={{ color: "var(--blue)" }}
              >
                <Phone className="w-3.5 h-3.5" /> {job.client.phone}
              </a>
            )}
          </div>

          <div className="relative shrink-0">
            <button data-testid="status-picker" onClick={() => setStatusOpen(!statusOpen)} className="flex items-center gap-1">
              <StatusBadge status={job.status} />
              <ChevronDown className="w-3 h-3 text-[#6E675F]" />
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-[#24211D] border border-[#2B2823] rounded-lg min-w-[170px] overflow-hidden">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    data-testid={`status-option-${s}`}
                    className="w-full text-left px-3 py-3 text-xs font-bold uppercase tracking-wider text-[#F0EAE2] hover:bg-[#2B2823]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[#2B2823]">
          <div>
            <div className="label-up mb-1">Contract</div>
            <div data-testid="job-contract" className="font-mono-num font-bold text-[#F0EAE2]" style={{ fontSize: 26 }}>
              {money(job.contract_total)}
            </div>
          </div>
          <div>
            <div className="label-up mb-1">Costs</div>
            <div data-testid="job-costs" className="font-mono-num font-bold text-[#A39990]" style={{ fontSize: 26 }}>
              {money(job.costs_to_date)}
            </div>
          </div>
          <div>
            <div className="label-up mb-1">Profit</div>
            <div data-testid="job-profit" className="font-mono-num font-bold" style={{ fontSize: 26, color: pColor }}>
              {money(job.profit)}
            </div>
            <div className="text-[11px] font-mono-num" style={{ color: pColor }}>
              {job.profit_pct}%
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="estimate">
        <TabsList className="w-full grid grid-cols-3 bg-[#0D0C0A] border border-[#2B2823] p-1 h-auto rounded-lg">
          {[
            ["estimate", "Estimate", "tab-estimate-trigger"],
            ["log", "Log", "tab-log-trigger"],
            ["expenses", "Expenses", "tab-expenses-trigger"],
          ].map(([v, label, tid]) => (
            <TabsTrigger
              key={v}
              value={v}
              data-testid={tid}
              className="min-h-[48px] font-industrial text-sm font-bold uppercase tracking-wider rounded-md text-[#A39990] data-[state=active]:bg-[#24211D] data-[state=active]:text-[#F0EAE2] data-[state=active]:border-b-2 data-[state=active]:border-[#2F7DE1]"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="estimate" className="mt-4">
          {/* Centerpiece: estimate from photos */}
          {!photoFlowOpen ? (
            <button
              onClick={() => setPhotoFlowOpen(true)}
              data-testid="photo-estimate-button"
              className="btn-bone w-full mb-6"
            >
              <ImagePlus className="w-4 h-4" /> Estimate from photos
            </button>
          ) : (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-industrial text-lg font-bold uppercase tracking-wider">Estimate from photos</h2>
                <button onClick={() => setPhotoFlowOpen(false)} className="text-sm font-semibold" style={{ color: "var(--blue)" }}>
                  Close
                </button>
              </div>
              <PhotoEstimate
                jobId={id}
                job={job}
                company={user?.company}
                taxRate={user?.company?.default_tax_rate ?? job.estimate?.tax_rate ?? 0}
                onSaved={load}
              />
            </div>
          )}

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
    <div className="space-y-4">
      <div className="label-up">Manual estimate</div>
      <div className="flex gap-2">
        <select
          data-testid="estimate-add-from-rate"
          onChange={(e) => {
            if (e.target.value) {
              addFromRate(e.target.value);
              e.target.value = "";
            }
          }}
          className={inputCls}
        >
          <option value="">+ Add from rate card…</option>
          {rates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · ${r.unit_price}/{r.unit}
            </option>
          ))}
        </select>
        <button onClick={addBlank} data-testid="add-line-item-button" className="btn-elev px-3">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => {
          const lt = Number(it.quantity || 0) * Number(it.unit_price || 0);
          return (
            <div key={idx} data-testid={`estimate-line-${idx}`} className="surface-card space-y-2">
              <div className="flex items-start gap-2">
                <input
                  value={it.description}
                  onChange={(e) => update(idx, "description", e.target.value)}
                  placeholder="Description"
                  className="flex-1 bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] text-sm px-2.5 py-2 rounded-lg outline-none"
                />
                <button onClick={() => removeItem(idx)} className="p-2 text-[#6E675F] hover:text-[#E04838]">
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
                  className="tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] font-mono-num px-2 rounded-lg outline-none"
                />
                <input
                  value={it.unit}
                  onChange={(e) => update(idx, "unit", e.target.value)}
                  className="tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] text-sm px-2 rounded-lg outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  value={it.unit_price}
                  onChange={(e) => update(idx, "unit_price", e.target.value)}
                  placeholder="$"
                  className="tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] font-mono-num px-2 rounded-lg outline-none"
                />
                <div className="tap-min flex items-center justify-end font-mono-num text-[#F0EAE2] font-bold">
                  {money(lt)}
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-[#6E675F] text-sm text-center py-6">No line items yet.</p>}
      </div>

      <div className="surface-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-up mb-0">Subtotal</span>
          <span className="font-mono-num text-[#F0EAE2] text-lg font-bold">{money(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label className="label-up mb-0">Tax rate %</label>
          <input
            type="number"
            step="0.01"
            data-testid="estimate-tax-rate"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="w-24 tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] font-mono-num px-2.5 rounded-lg text-right outline-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="label-up mb-0">Tax</span>
          <span className="font-mono-num text-[#F0EAE2] text-lg font-bold">{money(tax)}</span>
        </div>
        <div className="pt-3 border-t border-[#2B2823]">
          <div className="label-up mb-1">Grand total</div>
          <div data-testid="estimate-grand-total" className="font-mono-num font-extrabold text-[#F0EAE2]" style={{ fontSize: 32 }}>
            {money(total)}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-testid="estimate-status"
          className={inputCls}
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="approved">Approved</option>
        </select>
        <button onClick={save} disabled={saving} data-testid="save-estimate-button" className="btn-bone px-6">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function LogTab({ jobId, logs, hours, onChange }) {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [photoIds, setPhotoIds] = useState([]);
  const [hoursForm, setHoursForm] = useState({ date: new Date().toISOString().slice(0, 10), person: "", hours: "", hourly_rate: "" });
  const fileRef = useRef(null);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoIds([...photoIds, data.id]);
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
    <div className="space-y-5">
      <form onSubmit={addLog} className="surface-card space-y-3">
        <h3 className="font-industrial text-sm font-bold uppercase tracking-wider text-[#A39990]">Field log entry</h3>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="log-date" className={inputCls} />
        <textarea
          required
          data-testid="log-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What happened today?"
          className="w-full bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] text-[15px] px-3.5 py-3 rounded-lg outline-none"
        />
        {photoIds.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {photoIds.map((pid) => (
              <AuthImage key={pid} fileId={pid} className="w-16 h-16 object-cover rounded-lg border border-[#2B2823]" />
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickPhoto} />
          <button type="button" onClick={() => fileRef.current?.click()} data-testid="log-add-photo" className="btn-elev px-4">
            <Camera className="w-4 h-4" /> Photo
          </button>
          <button data-testid="add-log-button" className="btn-bone flex-1">
            Add log
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {logs.map((l) => (
          <div key={l.id} data-testid={`log-item-${l.id}`} className="surface-card">
            <div className="flex items-start justify-between gap-2">
              <div className="label-up mb-0">{usDate(l.date)}</div>
              <button onClick={() => delLog(l.id)} className="text-[#6E675F] hover:text-[#E04838]">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[15px] text-[#F0EAE2] mt-2 whitespace-pre-wrap">{l.note}</p>
            {l.photo_ids?.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {l.photo_ids.map((pid) => (
                  <AuthImage key={pid} fileId={pid} className="w-20 h-20 object-cover rounded-lg border border-[#2B2823]" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <details className="surface-card">
        <summary className="cursor-pointer font-industrial text-sm font-bold uppercase tracking-wider text-[#A39990]">
          Crew hours ({hours.length})
        </summary>
        <div className="pt-4 space-y-3">
          <form onSubmit={addHours} className="grid grid-cols-2 gap-2">
            <input type="date" value={hoursForm.date} onChange={(e) => setHoursForm({ ...hoursForm, date: e.target.value })} className={inputCls} />
            <input required placeholder="Person" value={hoursForm.person} onChange={(e) => setHoursForm({ ...hoursForm, person: e.target.value })} className={inputCls} />
            <input required type="number" step="0.25" placeholder="Hours" value={hoursForm.hours} onChange={(e) => setHoursForm({ ...hoursForm, hours: e.target.value })} className={inputCls + " font-mono-num"} />
            <input required type="number" step="0.01" placeholder="Rate $" value={hoursForm.hourly_rate} onChange={(e) => setHoursForm({ ...hoursForm, hourly_rate: e.target.value })} className={inputCls + " font-mono-num"} />
            <button className="btn-bone col-span-2 text-sm">Add hours</button>
          </form>
          <div className="space-y-2">
            {hours.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm bg-[#0D0C0A] rounded-lg p-3">
                <span className="text-[#A39990]">
                  {usDate(h.date)} · {h.person}
                </span>
                <span className="font-mono-num text-[#F0EAE2]">
                  {h.hours}h × {money(h.hourly_rate)} = {money(h.hours * h.hourly_rate)}
                </span>
                <button onClick={() => delHours(h.id)} className="text-[#6E675F] hover:text-[#E04838]">
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
    <div className="space-y-5">
      <div>
        <div className="label-up mb-1">Total job costs</div>
        <div data-testid="expenses-total" className="font-mono-num font-extrabold text-[#F0EAE2]" style={{ fontSize: 32 }}>
          {money(totalCost)}
        </div>
      </div>

      <form onSubmit={submit} className="surface-card space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Vendor" data-testid="expense-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputCls} />
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          <input required type="number" step="0.01" placeholder="Amount" data-testid="expense-amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls + " font-mono-num"} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
            <option value="material">Material</option>
            <option value="labor">Labor</option>
            <option value="equipment">Equipment</option>
            <option value="disposal">Disposal</option>
          </select>
        </div>
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickReceipt} />
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-elev px-4">
            <Camera className="w-4 h-4" />
            {form.receipt_photo_id ? "Attached" : "Receipt"}
          </button>
          <button data-testid="add-expense-button" className="btn-bone flex-1">
            Add expense
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {expenses.map((e) => (
          <div key={e.id} data-testid={`expense-item-${e.id}`} className="surface-card flex items-start gap-3">
            {e.receipt_photo_id && (
              <AuthImage fileId={e.receipt_photo_id} className="w-14 h-14 object-cover rounded-lg border border-[#2B2823]" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-bold text-[#F0EAE2] truncate">{e.vendor}</div>
                <div className="font-mono-num text-lg font-bold text-[#F0EAE2]">{money(e.amount)}</div>
              </div>
              <div className="label-up mb-0 mt-0.5">
                {usDate(e.date)} · {e.category}
              </div>
              {e.description && <div className="text-sm text-[#A39990] mt-1">{e.description}</div>}
            </div>
            <button onClick={() => del(e.id)} className="text-[#6E675F] hover:text-[#E04838]">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
