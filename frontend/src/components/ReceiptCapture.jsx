import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Plus, Trash2, RotateCw, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl } from "../lib/api";
import { apiError, billableAmount, EXPENSE_CATEGORIES, uploadReceipt } from "../lib/expenses";
import { money } from "../lib/format";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";

const blank = (jobId) => ({ vendor: "", date: "", subtotal: "", tax: "", amount: "", line_items: [],
  category: "", job_id: jobId || "", description: "", billable: true, markup_percent: 0, receipt_photo_id: null });

const Field = ({ label, name, value, onChange, ...props }) => <label className="block min-w-0">
  <span className="label-up">{label}</span>
  <input data-testid={`receipt-${name}`} className="input-field" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...props} />
</label>;

export const ReceiptCapture = ({ options, onClose, onSaved }) => {
  const [form, setForm] = useState(options.expense ? { ...options.expense } : blank(options.jobId));
  const [review, setReview] = useState(Boolean(options.expense || options.manual));
  const [jobs, setJobs] = useState([]);
  const [sorting, setSorting] = useState(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [preview, setPreview] = useState("");
  const [zoom, setZoom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const camera = useRef();
  const upload = useRef();
  const chosenFile = useRef(null);
  const busy = Boolean(progress || saving);
  const set = (key, value) => { setDirty(true); setForm((f) => ({ ...f, [key]: value })); };
  useEffect(() => { api.get("/jobs", { params: { include_archived: true } }).then(({ data }) => setJobs(data)).catch(() => setError("Jobs could not load. Close and reopen to retry; you can still save unassigned.")); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const close = () => { if (!busy && (!dirty || window.confirm("Discard this unsaved receipt?"))) onClose(); };

  const analyze = async (fileId) => {
    setProgress("Reading vendor, totals and line items. Matching active jobs…");
    const { data } = await api.post("/receipts/analyze", { receipt_photo_id: fileId });
    const e = data.extracted;
    setForm((f) => ({ ...f, vendor: e.vendor || "", date: e.date || "", subtotal: e.subtotal ?? "", tax: e.tax ?? "",
      amount: e.total ?? "", line_items: e.line_items, category: data.suggestions.category || "", job_id: data.suggestions.job_id || "" }));
    setSorting(data.suggestions); setWarnings(e.warnings || []); setReview(true);
  };
  const capture = async (file) => {
    if (!file) return;
    chosenFile.current = file;
    setError(""); setDirty(true); setPreview(URL.createObjectURL(file));
    setProgress("Preparing receipt upload…");
    let id = null;
    try {
      id = await uploadReceipt(file, setProgress);
      setForm((f) => ({ ...f, receipt_photo_id: id }));
      await analyze(id);
    } catch (e) {
      setError(apiError(e, e.message || "Could not capture receipt."));
      if (id) setReview(true);
    } finally { setProgress(""); }
  };
  const retry = async () => {
    if (!form.receipt_photo_id) return capture(chosenFile.current);
    setError("");
    try { await analyze(form.receipt_photo_id); } catch (e) { setError(apiError(e, "Reading failed. Enter details manually.")); }
    finally { setProgress(""); }
  };
  const refreshSuggestions = async () => {
    setProgress("Checking your updated details against active jobs…"); setError("");
    try {
      const { data } = await api.post("/receipts/suggestions", { vendor: form.vendor, date: form.date || null, description: form.description, line_items: numericLines(form.line_items) });
      setSorting(data); setForm((f) => ({ ...f, category: data.category || "", job_id: data.job_id || "" })); setDirty(true);
    } catch (e) { setError(apiError(e, "Could not refresh suggestions. Your edits are safe.")); }
    finally { setProgress(""); }
  };
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    const payload = { ...form, category: form.category || null, job_id: form.job_id || null,
      amount: Number(form.amount), subtotal: form.subtotal === "" || form.subtotal == null ? null : Number(form.subtotal),
      tax: form.tax === "" || form.tax == null ? null : Number(form.tax), markup_percent: Number(form.markup_percent || 0), line_items: numericLines(form.line_items) };
    try {
      if (options.expense) await api.put(`/expenses/${options.expense.id}`, payload);
      else await api.post("/expenses", payload);
      toast.success(!payload.job_id || !payload.category ? "Saved to Unsorted" : "Expense saved. Job costs updated."); onSaved();
    } catch (e) { setError(apiError(e, "Could not save. Check the fields and try again.")); }
    finally { setSaving(false); }
  };
  const photo = preview || (form.receipt_photo_id ? fileUrl(form.receipt_photo_id) : "");
  const chosen = jobs.find((j) => j.id === form.job_id);
  const late = chosen && ["Complete", "Invoiced", "Paid"].includes(chosen.status) && form.billable;
  const mismatch = form.subtotal !== "" && form.subtotal != null && form.tax !== "" && form.tax != null && form.amount !== "" && Math.abs(Number(form.subtotal) + Number(form.tax) - Number(form.amount)) > .011;
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent data-testid="receipt-capture-dialog" closeButtonProps={{ "data-testid": "receipt-close", disabled: busy }} overlayClassName="bg-[#12110F]"
      className="receipt-dialog max-w-5xl w-[calc(100%-16px)] max-h-[94dvh] overflow-y-auto bg-[#1C1A17] p-4 md:p-6 rounded-lg"
      onPointerDownOutside={(e) => e.preventDefault()}>
      <DialogTitle className="uppercase tracking-wide pr-12">{options.expense ? "Review expense" : "Capture receipt"}</DialogTitle>
      <DialogDescription>Check the photo, correct anything, then save. Nothing is filed until you confirm.</DialogDescription>
      <input data-testid="receipt-camera-input" ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => { capture(e.target.files?.[0]); e.target.value = ""; }} />
      <input data-testid="receipt-upload-input" ref={upload} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { capture(e.target.files?.[0]); e.target.value = ""; }} />
      {progress && <div data-testid="receipt-progress" role="status" aria-live="polite" className="py-4 border-y border-[#3D3830] flex gap-3 items-center"><RotateCw className="animate-spin w-5 h-5 shrink-0 text-[#2F7DE1]" />{progress}</div>}
      {error && <div data-testid="receipt-error" role="alert" className="border border-[#3D3830] rounded-lg p-3 space-y-2"><p>{error}</p>{chosenFile.current && <button type="button" disabled={busy} data-testid="receipt-retry" onClick={retry} className="btn-elev">Retry receipt reading</button>}</div>}
      {!review && !progress && <div className="space-y-4 py-8">
        <div className="grid grid-cols-2 gap-3"><button data-testid="receipt-take-photo" className="btn-bone" onClick={() => camera.current.click()}><Camera className="w-5 h-5" />Camera</button>
          <button data-testid="receipt-upload-photo" className="btn-elev" onClick={() => upload.current.click()}><Upload className="w-5 h-5" />Upload</button></div>
        <p className="text-[#A39990]">JPEG, PNG or WebP · up to 20 MB. Include the whole receipt and keep the totals in focus.</p>
        <button data-testid="receipt-manual-entry" className="tap-min text-[#2F7DE1]" onClick={() => { setReview(true); setError(""); }}>Enter an expense without a photo</button>
      </div>}
      {review && <div className={photo ? "receipt-review" : ""}>
        {photo && <aside className="min-w-0"><div className="sticky top-0 space-y-2"><button type="button" data-testid="receipt-zoom" onClick={() => setZoom(!zoom)} className="w-full text-left">
          <img data-testid="receipt-photo" src={photo} alt="Receipt to verify against extracted details" className="w-full rounded-md border border-[#3D3830]" /><span className="tap-min flex items-center gap-1 text-[#2F7DE1] text-[15px]"><ZoomIn className="w-4 h-4" />{zoom ? "Close" : "Enlarge"}</span>
        </button></div></aside>}
        <form data-testid="receipt-confirmation-form" onSubmit={save} className="min-w-0 space-y-6">
          {warnings.length > 0 && <div data-testid="receipt-warnings" className="text-[#A39990]">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
          <div className="grid gap-3 md:grid-cols-2"><Field label="Vendor" name="vendor" required value={form.vendor} onChange={(v) => set("vendor", v)} />
            <Field label="Receipt date" name="date" type="date" required value={form.date} onChange={(v) => set("date", v)} />
            <Field label="Subtotal ($)" name="subtotal" type="number" min="0" step="0.01" value={form.subtotal} onChange={(v) => set("subtotal", v)} />
            <Field label="Tax ($)" name="tax" type="number" min="0" step="0.01" value={form.tax} onChange={(v) => set("tax", v)} />
            <Field label="Total cost ($)" name="total" required type="number" min="0" step="0.01" value={form.amount} onChange={(v) => set("amount", v)} /></div>
          {mismatch && <p data-testid="receipt-total-mismatch" className="text-[#A39990]">Subtotal + tax differs from total. Check for a discount, fee or reading error before saving.</p>}
          <ReceiptLines items={form.line_items} onChange={(items) => set("line_items", items)} />
          <div className="space-y-3"><span className="label-up">Category</span><div className="flex flex-wrap gap-2">
            {[["", "Unassigned"], ...EXPENSE_CATEGORIES].map(([value, label]) => <button key={value} type="button" data-testid={`receipt-category-${value || "unassigned"}`} aria-pressed={(form.category || "") === value} onClick={() => set("category", value)} className={`btn-elev ${form.category === value || (!form.category && !value) ? "!border-[#2F7DE1] !text-[#2F7DE1]" : ""}`}>{label}</button>)}
          </div><p data-testid="receipt-category-reason" className="text-[#A39990]">{sorting ? (form.category === (sorting.category || "") ? sorting.category_reason : "Your category override will be saved. Repeated vendor corrections guide future receipts.") : "Choose a category or keep it unassigned."}</p></div>
          <div className="space-y-3"><label className="block"><span className="label-up">Job</span><select data-testid="receipt-job" className="input-field" value={form.job_id || ""} onChange={(e) => set("job_id", e.target.value)}>
            <option value="">Unassigned — Unsorted tray</option>{jobs.filter((j) => !j.archived || j.id === form.job_id).map((j) => <option key={j.id} value={j.id}>{`#${j.job_number} · ${j.title} · ${j.status}`}</option>)}</select></label>
            <div className="flex flex-col gap-2">{(sorting?.ranked_jobs || []).slice(0, 3).map((j) => <button data-testid={`receipt-job-suggestion-${j.job_id}`} key={j.job_id} type="button" aria-pressed={form.job_id === j.job_id} onClick={() => set("job_id", j.job_id)} className={`btn-elev !text-left !justify-start !normal-case !tracking-normal ${form.job_id === j.job_id ? "!border-[#2F7DE1] !text-[#2F7DE1]" : ""}`}>{`#${j.job_number} · ${j.title}`}</button>)}</div>
            <p data-testid="receipt-job-reason" className="text-[#A39990]">{sorting ? (form.job_id === (sorting.job_id || "") ? sorting.job_reason : "You chose this job instead of the suggestion.") : "Leave unassigned if no job fits."}</p>
            <button type="button" data-testid="receipt-refresh-suggestions" disabled={busy || !form.vendor} onClick={refreshSuggestions} className="tap-min text-[#2F7DE1] text-left">Refresh suggestions from edited details</button>
          </div>
          <div className="space-y-3 border-t border-[#3D3830] pt-4"><span className="label-up">Billable to client?</span><div className="flex gap-2">{[true, false].map((value) => <button data-testid={`receipt-billable-${value ? "yes" : "no"}`} key={String(value)} type="button" aria-pressed={form.billable === value} onClick={() => set("billable", value)} className={`btn-elev flex-1 ${form.billable === value ? "!border-[#2F7DE1] !text-[#2F7DE1]" : ""}`}>{value ? "Yes" : "No"}</button>)}</div>
            <Field label="Markup percent" name="markup" type="number" min="0" max="1000" step="0.01" value={form.markup_percent} onChange={(v) => set("markup_percent", v)} />
            <div><span className="label-up">{form.billable ? "To rebill · cost + markup" : "Non-billable · job cost only"}</span><p data-testid="receipt-billable-amount" className="text-3xl font-bold font-mono-num">{money(billableAmount(form))}</p></div>
          </div>
          {late && <p data-testid="receipt-late-warning" className="border-l-2 border-[#3D3830] pl-3">This job is already {chosen.status.toLowerCase()}. A new attachment will raise a separate Unbilled Materials warning on the Board.</p>}
          <Field label="Notes" name="description" value={form.description} onChange={(v) => set("description", v)} />
          {(!form.job_id || !form.category) && <p data-testid="receipt-unsorted-note" className="text-[#A39990]">This receipt will wait in Unsorted until both job and category are assigned.</p>}
          <button data-testid="receipt-save" type="submit" disabled={busy} className="btn-bone w-full">{saving ? "Saving…" : options.expense ? "Save changes" : "Confirm & save"}</button>
        </form>
      </div>}
      {zoom && <div className="fixed inset-0 z-50 bg-[#12110F] overflow-auto p-4"><button type="button" data-testid="receipt-zoom-close" onClick={() => setZoom(false)} className="btn-elev sticky top-0">Back to receipt</button><img data-testid="receipt-photo-expanded" src={photo} alt="Full-size receipt" className="min-w-[600px] max-w-none mt-4" /></div>}
    </DialogContent>
  </Dialog>;
};

const numericLines = (items) => items.map((item) => ({ ...item, ...Object.fromEntries(["quantity", "unit_price", "amount"].map((key) => [key, item[key] === "" || item[key] == null ? null : Number(item[key])])) }));

const ReceiptLines = ({ items, onChange }) => {
  const edit = (index, key, value) => onChange(items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  return <section className="space-y-3"><h3 className="label-up">Line items · as printed</h3>
    {items.map((item, index) => <div key={index} data-testid={`receipt-line-${index}`} className="space-y-2 border-b border-[#3D3830] pb-3">
      <Field label="Description" name={`line-${index}-description`} value={item.description} onChange={(v) => edit(index, "description", v)} />
      <div className="grid gap-2 lg:grid-cols-3">{[["quantity", "Qty"], ["unit_price", "Unit price ($)"], ["amount", "Line total ($)"]].map(([key, label]) => <Field key={key} label={label} name={`line-${index}-${key}`} type="number" min="0" step="0.01" value={item[key]} onChange={(v) => edit(index, key, v)} />)}</div>
      <button type="button" aria-label={`Remove line ${index + 1}`} data-testid={`receipt-line-${index}-remove`} className="btn-elev" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" />Remove</button>
    </div>)}
    <button type="button" data-testid="receipt-add-line" className="btn-elev" onClick={() => onChange([...items, { description: "", quantity: null, unit_price: null, amount: null }])}><Plus className="w-4 h-4" />Add item</button>
  </section>;
};
