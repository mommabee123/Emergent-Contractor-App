import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AuthImage from "../components/AuthImage";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (user) setForm(user.company || {});
  }, [user]);

  if (!form) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/company", { ...form, default_tax_rate: Number(form.default_tax_rate || 0) });
      await refreshUser();
      toast.success("Saved");
    } catch {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const updated = { ...form, logo_file_id: data.id };
      setForm(updated);
      await api.put("/company", { ...updated, default_tax_rate: Number(updated.default_tax_rate || 0) });
      await refreshUser();
      toast.success("Logo updated");
    } catch {
      toast.error("Upload failed");
    }
  };

  const renderField = (k, label, type = "text") => (
    <div key={k}>
      <label className="label-up">{label}</label>
      <input
        data-testid={`settings-${k}`}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={form[k] ?? ""}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="input-field"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="font-industrial text-3xl font-bold uppercase tracking-wider">Company profile</h1>

      <div className="surface-card space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-[#0D0C0A] border border-[#2B2823] rounded-lg flex items-center justify-center overflow-hidden">
            {form.logo_file_id ? (
              <AuthImage fileId={form.logo_file_id} thumb={false} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-[#6E675F]">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
            <button data-testid="upload-logo-button" onClick={() => fileRef.current?.click()} className="btn-elev">
              <Upload className="w-4 h-4" /> Upload logo
            </button>
          </div>
        </div>

        {renderField("business_name", "Business name")}
        {renderField("phone", "Phone")}
        {renderField("email", "Email")}
        {renderField("address", "Address")}
        {renderField("license_number", "License number")}
        {renderField("default_tax_rate", "Default tax rate (%)", "number")}

        <div>
          <label className="label-up">Payment instructions</label>
          <textarea
            data-testid="settings-payment_instructions"
            value={form.payment_instructions || ""}
            onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
            rows={4}
            className="input-field py-3"
          />
        </div>

        <button onClick={save} disabled={saving} data-testid="save-settings-button" className="btn-bone w-full min-h-[52px]">
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
