import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

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
    <div className="min-h-screen bg-[#12110F] flex flex-col">
      <div className="max-w-md w-full mx-auto px-5 pt-16 pb-8 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <span className="w-4 h-4 bg-[#F5F1EA] rotate-45 inline-block" />
          <span className="font-industrial text-3xl font-bold uppercase tracking-wider">Jobsite</span>
        </div>

        <h1 className="font-industrial text-4xl font-bold uppercase tracking-wide mb-2">
          {mode === "login" ? "Sign in" : "Set up shop"}
        </h1>
        <p className="text-[#A39990] text-sm mb-10">
          {mode === "login" ? "Field-ready paperwork. Every job pays." : "One user. One company. No demo data missing."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="label-up">Business name</label>
              <input
                data-testid="register-business-input"
                required
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="e.g. Apex Painting & Trades"
                className="input-field"
              />
            </div>
          )}

          <div>
            <label className="label-up">Email</label>
            <input
              data-testid="login-email-input"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label-up">Password</label>
            <input
              data-testid="login-password-input"
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit-button"
            disabled={busy}
            className="btn-bone w-full min-h-[52px] text-base"
          >
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          data-testid="toggle-auth-mode"
          className="mt-8 text-sm font-semibold"
          style={{ color: "var(--blue)" }}
        >
          {mode === "login" ? "New here? Create an account →" : "Already registered? Sign in →"}
        </button>
      </div>
    </div>
  );
}
