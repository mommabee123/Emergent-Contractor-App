import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import RateCard from "./pages/RateCard";
import Settings from "./pages/Settings";
import "./App.css";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" theme="dark" richColors />
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
          <Route path="/jobs/:id" element={<Protected><JobDetail /></Protected>} />
          <Route path="/clients" element={<Protected><Clients /></Protected>} />
          <Route path="/clients/:id" element={<Protected><ClientDetail /></Protected>} />
          <Route path="/rate-card" element={<Protected><RateCard /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
