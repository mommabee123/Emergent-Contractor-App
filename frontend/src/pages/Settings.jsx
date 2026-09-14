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
      <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
      <input
        data-testid={`settings-${k}`}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={form[k] ?? ""}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="w-full tap-min bg-[#080B10] border border-[#324866] focus:border-[#FF5F15] text-white text-base px-3.5 rounded-md outline-none"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="font-industrial text-3xl font-black uppercase tracking-wider">Company profile</h1>

      <div className="bg-[#131B26] border border-[#223147] rounded-md p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-[#080B10] border border-[#324866] rounded-md flex items-center justify-center overflow-hidden">
            {form.logo_file_id ? (
              <AuthImage fileId={form.logo_file_id} thumb={false} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-mono uppercase text-slate-600">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
            <button
              data-testid="upload-logo-button"
              onClick={() => fileRef.current?.click()}
              className="tap-min px-4 bg-[#1A2433] border border-[#324866] text-slate-100 text-sm font-semibold uppercase tracking-wide rounded-md flex items-center gap-1.5"
            >
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
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
            Payment instructions
          </label>
          <textarea
            data-testid="settings-payment_instructions"
            value={form.payment_instructions || ""}
            onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
            rows={4}
            className="w-full bg-[#080B10] border border-[#324866] focus:border-[#FF5F15] text-white text-base px-3.5 py-2.5 rounded-md outline-none"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          data-testid="save-settings-button"
          className="w-full min-h-[52px] bg-[#FF5F15] hover:bg-[#E64F0A] text-white font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}
