import { useRef, useState } from "react";
import { api, fileUrl } from "../lib/api";
import { money } from "../lib/format";
import QuoteDoc from "./QuoteDoc";
import { Camera, Mic, Square, X, AlertTriangle, Plus, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

const inputCls = "input-field";
const GRADES = ["economy", "standard", "premium"];

export default function PhotoEstimate({ jobId, job, company, taxRate, onSaved }) {
  const [stage, setStage] = useState("input"); // input | analyzing | form | draft | quote
  const [error, setError] = useState(null);
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [dims, setDims] = useState({ length: "", width: "", height: "", coats: "2", grade: "standard", access: "", timeline: "" });
  const [assumed, setAssumed] = useState({});
  const [questionToggles, setQuestionToggles] = useState({});
  const [lines, setLines] = useState([]);
  const [priceEdits, setPriceEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const fileRef = useRef(null);

  /* ---------- voice (optional layer on top of typing) ---------- */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "voice.webm");
        try {
          const { data } = await api.post("/transcribe", fd);
          if (data.text) {
            setDescription((d) => (d ? d + " " + data.text : data.text));
            toast.success("Voice note transcribed");
          }
        } catch (err) {
          toast.error(err.response?.data?.detail || "Transcription failed — type instead");
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone unavailable — type the description instead");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  /* ---------- photos ---------- */
  const onPickPhotos = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photoFiles.length);
    if (!files.length) return;
    setPhotoFiles((p) => [...p, ...files]);
    setPhotoPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removePhoto = (i) => {
    setPhotoFiles(photoFiles.filter((_, x) => x !== i));
    setPhotoPreviews(photoPreviews.filter((_, x) => x !== i));
  };

  /* ---------- analyze ---------- */
  const analyze = async () => {
    if (!description.trim()) return toast.error("Describe what you're bidding first");
    if (!photoFiles.length) return toast.error("Add at least one photo");
    setError(null);
    setStage("analyzing");
    try {
      const fd = new FormData();
      photoFiles.forEach((f) => fd.append("photos", f));
      fd.append("description", description);
      const { data } = await api.post(`/jobs/${jobId}/analyze-photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setAnalysis(data);
      const a = data.assumptions || {};
      const newAssumed = {};
      setDims((d) => {
        const next = { ...d };
        if (a.ceiling_height_ft) { next.height = String(a.ceiling_height_ft); newAssumed.height = true; }
        if (a.coats) { next.coats = String(a.coats); newAssumed.coats = true; }
        if (a.materials_grade) { next.grade = a.materials_grade; newAssumed.grade = true; }
        return next;
      });
      setAssumed(newAssumed);
      const toggles = {};
      (data.items || []).forEach((it, i) => {
        if (it.uncertain) toggles[i] = false;
      });
      setQuestionToggles(toggles);
      setStage("form");
    } catch (err) {
      setError(err.response?.data?.detail || "Analysis failed. Try again.");
      setStage("input");
    }
  };

  const editDim = (k, v) => {
    setDims({ ...dims, [k]: v });
    setAssumed((a) => ({ ...a, [k]: false }));
  };

  /* ---------- build ---------- */
  const build = async () => {
    const L = Number(dims.length) || 0;
    const W = Number(dims.width) || 0;
    const H = Number(dims.height) || 8;
    const wallArea = Math.round(2 * (L + W) * H * 100) / 100;
    const ceilingArea = Math.round(L * W * 100) / 100;
    const trimLf = Math.round(2 * (L + W) * 100) / 100;
    try {
      const items = (analysis.items || []).filter((it, i) => !(it.uncertain && !questionToggles[i]));
      const { data } = await api.post(`/jobs/${jobId}/build-estimate`, {
        items,
        wall_area: wallArea,
        ceiling_area: ceilingArea,
        trim_lf: trimLf,
        coats: Number(dims.coats) || 1,
      });
      setLines(data.line_items);
      setPriceEdits({});
      setStage("draft");
    } catch {
      toast.error("Could not build estimate");
    }
  };

  /* ---------- draft editing ---------- */
  const updateLine = (i, field, val) => {
    const copy = [...lines];
    copy[i] = { ...copy[i], [field]: val };
    if (field === "unit_price" && Number(val) > 0) copy[i].needs_price = false;
    setLines(copy);
  };
  const removeLine = (i) => setLines(lines.filter((_, x) => x !== i));
  const addLine = () =>
    setLines([...lines, { description: "", quantity: 1, unit: "each", unit_price: 0, line_total: 0, needs_price: true, rate_item_id: null, note: "" }]);

  const applyPrice = async (i) => {
    const edit = priceEdits[i];
    if (!edit || !Number(edit.price)) return toast.error("Enter a price");
    const line = lines[i];
    if (edit.save) {
      try {
        const { data: existing } = await api.get("/rate-card");
        const dup = existing.find(
          (r) => r.name.trim().toLowerCase() === line.description.trim().toLowerCase() && r.unit === line.unit
        );
        if (dup) {
          await api.put(`/rate-card/${dup.id}`, { ...dup, unit_price: Number(edit.price), confirmed: true });
          toast.success("Updated existing rate card item");
        } else {
          await api.post("/rate-card", {
            name: line.description,
            unit: line.unit,
            unit_price: Number(edit.price),
            category: "labor",
            confirmed: true,
          });
          toast.success("Saved to your rate card");
        }
      } catch {
        toast.error("Could not save to rate card");
      }
    }
    updateLine(i, "unit_price", edit.price);
  };

  const lineNeedsAttention = (l) => l.needs_price || !Number(l.unit_price) || !Number(l.quantity);
  const needsPriceCount = lines.filter(lineNeedsAttention).length;
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const tax = subtotal * (Number(taxRate) / 100);
  const total = subtotal + tax;

  const persistEstimate = async (status) => {
    const payload = {
      line_items: lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unit: l.unit,
        unit_price: Number(l.unit_price) || 0,
        line_total: round2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)),
      })),
      tax_rate: Number(taxRate) || 0,
      status,
      notes: analysis?.scope_summary || "",
    };
    const { data } = await api.put(`/jobs/${jobId}/estimate`, payload);
    return data;
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await persistEstimate("draft");
      toast.success("Draft saved");
      onSaved();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const generateQuote = async () => {
    if (needsPriceCount > 0) {
      toast.error(`Resolve ${needsPriceCount} "needs price" line${needsPriceCount > 1 ? "s" : ""} before generating a quote`);
      return;
    }
    setSaving(true);
    try {
      const est = await persistEstimate("sent");
      setQuoteData({ estimate: est, scope: analysis?.scope_summary || "" });
      setStage("quote");
      onSaved();
    } catch {
      toast.error("Could not generate quote");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- stages ---------- */

  if (stage === "quote" && quoteData) {
    return (
      <QuoteDoc
        company={company}
        job={job}
        estimate={quoteData.estimate}
        scope={quoteData.scope}
        onClose={() => setStage("draft")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* INPUT */}
      {stage === "input" && (
        <div className="surface-card space-y-4">
          <h3 className="font-industrial text-base font-bold uppercase tracking-wider text-[#F0EAE2]">
            Estimate from photos
          </h3>

          <div>
            <label className="label-up">What are you bidding?</label>
            <textarea
              data-testid="bid-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="e.g. Interior repaint of living room and hallway, walls only, two coats, client keeps trim as-is…"
              className="w-full bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] text-[15px] px-3.5 py-3 rounded-lg outline-none"
            />
            <button
              type="button"
              data-testid="voice-record-button"
              onClick={recording ? stopRecording : startRecording}
              className={`mt-2 tap-min px-4 rounded-lg flex items-center gap-2 text-sm font-semibold ${
                recording
                  ? "bg-[#E04838] text-white"
                  : "bg-[#24211D] border border-[#2B2823] text-[#A39990] hover:text-[#F0EAE2]"
              }`}
            >
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {recording ? "Stop & transcribe" : "Record voice note (optional)"}
            </button>
          </div>

          <div>
            <label className="label-up">Job site photos (1–5)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              data-testid="photo-upload-input"
              onChange={onPickPhotos}
            />
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg border border-[#2B2823]" />
                  <button
                    onClick={() => removePhoto(i)}
                    data-testid={`photo-remove-${i}`}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-[#E04838] text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {photoFiles.length < 5 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  data-testid="add-photos-button"
                  className="w-20 h-20 rounded-lg border border-dashed border-[#2B2823] text-[#6E675F] hover:text-[#F0EAE2] hover:border-[#2F7DE1] flex flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase"
                >
                  <Camera className="w-5 h-5" />
                  Add
                </button>
              )}
            </div>
          </div>

          {error && (
            <div data-testid="analysis-error" className="flex items-start gap-2 text-sm" style={{ color: "var(--red)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5" /> {error}
            </div>
          )}

          <button
            onClick={analyze}
            data-testid="analyze-photos-button"
            className="btn-bone w-full"
          >
            Analyze photos
          </button>
        </div>
      )}

      {/* ANALYZING */}
      {stage === "analyzing" && (
        <div className="surface-card py-12 flex flex-col items-center gap-3" data-testid="analysis-loading">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--blue)" }} />
          <p className="text-[#A39990] text-sm">Reading photos and your description…</p>
          <p className="text-[#6E675F] text-xs">Identifying scope, surfaces and conditions. No prices are being invented.</p>
        </div>
      )}

      {/* SCOPE FORM */}
      {stage === "form" && analysis && (
        <div className="space-y-4">
          <div className="surface-card space-y-3">
            <h3 className="font-industrial text-base font-bold uppercase tracking-wider">What the photos show</h3>
            <p className="text-[15px] text-[#F0EAE2]" data-testid="scope-summary">{analysis.scope_summary}</p>
            {analysis.conditions?.length > 0 && (
              <ul className="text-sm text-[#A39990] list-disc pl-5 space-y-1">
                {analysis.conditions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Questions from photo-vs-description mismatches */}
          {(analysis.items || []).some((it) => it.uncertain) && (
            <div className="surface-card space-y-3" style={{ borderColor: "var(--amber)" }}>
              <h3 className="font-industrial text-base font-bold uppercase tracking-wider" style={{ color: "var(--amber)" }}>
                Confirm scope
              </h3>
              {(analysis.items || []).map((it, i) =>
                it.uncertain ? (
                  <label
                    key={i}
                    data-testid={`scope-question-${i}`}
                    className="flex items-start gap-3 tap-min cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!questionToggles[i]}
                      onChange={(e) => setQuestionToggles({ ...questionToggles, [i]: e.target.checked })}
                      className="mt-1 w-5 h-5 accent-[#2F7DE1]"
                      data-testid={`scope-question-toggle-${i}`}
                    />
                    <span className="text-[15px] text-[#F0EAE2]">{it.question || it.description}</span>
                  </label>
                ) : null
              )}
            </div>
          )}

          <div className="surface-card space-y-4">
            <h3 className="font-industrial text-base font-bold uppercase tracking-wider">What photos can't tell us</h3>
            <div className="grid grid-cols-2 gap-3">
              <DimField label="Length (ft)" value={dims.length} onChange={(v) => editDim("length", v)} testid="dim-length" />
              <DimField label="Width (ft)" value={dims.width} onChange={(v) => editDim("width", v)} testid="dim-width" />
              <DimField label="Ceiling height (ft)" value={dims.height} onChange={(v) => editDim("height", v)} testid="dim-height" assumed={assumed.height} />
              <DimField label="Coats" value={dims.coats} onChange={(v) => editDim("coats", v)} testid="dim-coats" assumed={assumed.coats} />
            </div>
            <div>
              <label className="label-up">
                Materials grade {assumed.grade && <AssumedBadge />}
              </label>
              <select
                data-testid="grade-select"
                value={dims.grade}
                onChange={(e) => editDim("grade", e.target.value)}
                className={inputCls}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g[0].toUpperCase() + g.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-up">Access notes</label>
              <input
                data-testid="access-notes-input"
                value={dims.access}
                onChange={(e) => editDim("access", e.target.value)}
                placeholder="Ladder needed, occupied home, pets…"
                className={inputCls}
              />
            </div>
            <div>
              <label className="label-up">Target timeline</label>
              <input
                data-testid="timeline-input"
                value={dims.timeline}
                onChange={(e) => editDim("timeline", e.target.value)}
                placeholder="e.g. Start next Monday, 3 days"
                className={inputCls}
              />
            </div>
          </div>

          <button onClick={build} data-testid="build-estimate-button" className="btn-bone w-full">
            Build estimate
          </button>
          <button onClick={() => setStage("input")} className="btn-elev w-full">
            Back
          </button>
        </div>
      )}

      {/* DRAFT TABLE */}
      {stage === "draft" && (
        <div className="space-y-4">
          {needsPriceCount > 0 && (
            <div
              data-testid="needs-price-warning"
              className="rounded-lg p-3 flex items-start gap-2 text-sm"
              style={{ background: "rgba(224,162,56,0.12)", border: "1px solid var(--amber)", color: "var(--amber)" }}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {needsPriceCount} line{needsPriceCount > 1 ? "s" : ""} need a price or quantity before this estimate can be sent.
            </div>
          )}

          <div className="space-y-2">
            {lines.map((l, i) => {
              const lt = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
              const needs = lineNeedsAttention(l);
              return (
                <div
                  key={i}
                  data-testid={`photo-estimate-line-${i}`}
                  className="surface-card"
                  style={needs ? { borderColor: "var(--amber)" } : undefined}
                >
                  <div className="flex items-start gap-2">
                    <input
                      value={l.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Description"
                      data-testid={`line-desc-${i}`}
                      className="flex-1 bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] text-sm px-2.5 py-2 rounded-lg outline-none"
                    />
                    <button onClick={() => removeLine(i)} data-testid={`line-remove-${i}`} className="p-2 text-[#6E675F] hover:text-[#E04838]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    <input
                      type="number"
                      step="0.01"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, "quantity", e.target.value)}
                      data-testid={`line-qty-${i}`}
                      className="tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] font-mono-num px-2 rounded-lg outline-none"
                    />
                    <input
                      value={l.unit}
                      onChange={(e) => updateLine(i, "unit", e.target.value)}
                      data-testid={`line-unit-${i}`}
                      className="tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] text-sm px-2 rounded-lg outline-none"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={l.unit_price}
                      onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                      data-testid={`line-price-${i}`}
                      className="tap-min bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] font-mono-num px-2 rounded-lg outline-none"
                    />
                    <div
                      className="tap-min flex items-center justify-end font-mono-num font-bold"
                      style={{ color: needs ? "var(--amber)" : "#F0EAE2" }}
                      data-testid={`line-total-${i}`}
                    >
                      {needs ? "needs price" : money(lt)}
                    </div>
                  </div>

                  {needs && (
                    <div className="mt-3 pt-3 border-t border-[#2B2823] flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Your price per unit"
                        data-testid={`needs-price-input-${i}`}
                        value={priceEdits[i]?.price || ""}
                        onChange={(e) => setPriceEdits({ ...priceEdits, [i]: { price: e.target.value, save: priceEdits[i]?.save ?? true } })}
                        className="tap-min w-44 bg-[#0D0C0A] border border-[#2B2823] focus:border-[#2F7DE1] text-[#F0EAE2] font-mono-num px-2.5 rounded-lg outline-none"
                      />
                      <label className="flex items-center gap-2 text-xs text-[#A39990]">
                        <input
                          type="checkbox"
                          data-testid={`save-to-rate-card-${i}`}
                          checked={priceEdits[i]?.save ?? true}
                          onChange={(e) => setPriceEdits({ ...priceEdits, [i]: { price: priceEdits[i]?.price || "", save: e.target.checked } })}
                          className="w-4 h-4 accent-[#2F7DE1]"
                        />
                        Save to my rate card
                      </label>
                      <button
                        onClick={() => applyPrice(i)}
                        data-testid={`apply-price-${i}`}
                        className="tap-min px-4 text-sm font-bold rounded-lg"
                        style={{ background: "var(--blue)", color: "#fff" }}
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={addLine} data-testid="draft-add-line" className="btn-elev w-full">
            <Plus className="w-4 h-4" /> Add line
          </button>

          <div className="surface-card space-y-2">
            <TotRow label="Subtotal" value={money(subtotal)} />
            <TotRow label={`Tax (${taxRate || 0}%)`} value={money(tax)} />
            <div className="pt-3 mt-1 border-t border-[#2B2823]">
              <div className="label-up">Total</div>
              <div data-testid="photo-estimate-total" className="font-mono-num font-extrabold" style={{ fontSize: 34, color: "#F0EAE2" }}>
                {money(total)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={saveDraft} disabled={saving} data-testid="save-draft-button" className="btn-elev">
              {saving ? "Saving…" : "Save as draft"}
            </button>
            <button
              onClick={generateQuote}
              disabled={saving || needsPriceCount > 0}
              data-testid="generate-quote-button"
              className="btn-bone"
            >
              <FileText className="w-4 h-4" /> Generate quote
            </button>
          </div>
          <button onClick={() => setStage("form")} className="w-full text-center text-sm font-semibold" style={{ color: "var(--blue)" }}>
            ← Back to scope form
          </button>
        </div>
      )}
    </div>
  );
}

function AssumedBadge() {
  return (
    <span
      className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ background: "rgba(47,125,225,0.15)", color: "var(--blue)" }}
      data-testid="assumed-badge"
    >
      assumed — confirm
    </span>
  );
}

function DimField({ label, value, onChange, testid, assumed }) {
  return (
    <div>
      <label className="label-up">
        {label} {assumed && <AssumedBadge />}
      </label>
      <input
        type="number"
        step="0.5"
        min="0"
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field font-mono-num"
      />
    </div>
  );
}

function TotRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="label-up mb-0">{label}</span>
      <span className="font-mono-num text-lg font-bold text-[#F0EAE2]">{value}</span>
    </div>
  );
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
