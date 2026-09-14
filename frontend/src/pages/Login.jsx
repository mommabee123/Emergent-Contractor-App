import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { HardHat } from "lucide-react";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [business, setBusiness] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, business);
      toast.success(mode === "login" ? "Signed in" : "Account created");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col">
      <div className="max-w-md w-full mx-auto px-5 pt-16 pb-8 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <span className="w-4 h-4 bg-[#FF5F15] rotate-45 inline-block" />
          <span className="font-industrial text-3xl font-black uppercase tracking-wider">Jobsite</span>
        </div>

        <h1 className="font-industrial text-4xl font-black uppercase tracking-wide mb-2">
          {mode === "login" ? "Sign in" : "Set up shop"}
        </h1>
        <p className="text-slate-400 text-sm mb-8 font-mono">
          {mode === "login" ? "Field-ready paperwork. Every job pays." : "One user. One company. No demo data missing."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Business name
              </label>
              <input
                data-testid="register-business-input"
                required
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="e.g. Apex Painting & Trades"
                className="w-full tap-min bg-[#080B10] border border-[#324866] focus:border-[#FF5F15] focus:ring-1 focus:ring-[#FF5F15] text-white text-base px-3.5 rounded-md outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
            <input
              data-testid="login-email-input"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full tap-min bg-[#080B10] border border-[#324866] focus:border-[#FF5F15] focus:ring-1 focus:ring-[#FF5F15] text-white text-base px-3.5 rounded-md outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <input
              data-testid="login-password-input"
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full tap-min bg-[#080B10] border border-[#324866] focus:border-[#FF5F15] focus:ring-1 focus:ring-[#FF5F15] text-white text-base px-3.5 rounded-md outline-none"
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit-button"
            disabled={busy}
            className="w-full min-h-[52px] bg-[#FF5F15] hover:bg-[#E64F0A] active:bg-[#CC4405] text-white font-bold text-base uppercase tracking-wider rounded-md border border-[#FF8F57]/40 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <HardHat className="w-5 h-5" />
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          data-testid="toggle-auth-mode"
          className="mt-6 text-sm text-slate-400 hover:text-white font-mono"
        >
          {mode === "login" ? "New here? Create an account →" : "Already registered? Sign in →"}
        </button>
      </div>
    </div>
  );
}
