import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, Users, ListOrdered, Settings, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const items = [
  { to: "/", label: "Board", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/jobs", label: "Jobs", icon: Briefcase, testid: "nav-jobs" },
  { to: "/clients", label: "Clients", icon: Users, testid: "nav-clients" },
  { to: "/rate-card", label: "Rates", icon: ListOrdered, testid: "nav-ratecard" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#131B26] border-b border-[#223147]">
        <div className="max-w-md md:max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 bg-[#FF5F15] rotate-45 inline-block" />
            <span className="font-industrial text-2xl font-black uppercase tracking-wider">Jobsite</span>
          </div>
          <button
            data-testid="logout-button"
            onClick={doLogout}
            className="tap-min px-3 text-slate-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{user?.email}</span>
          </button>
        </div>
      </header>

      {/* Desktop side/top nav (secondary) */}
      <nav className="hidden md:block bg-[#131B26] border-b border-[#223147]">
        <div className="max-w-5xl mx-auto px-4 flex items-center">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              data-testid={it.testid + "-desktop"}
              className={({ isActive }) =>
                `px-5 py-3.5 text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 ${
                  isActive
                    ? "text-[#FF5F15] border-[#FF5F15]"
                    : "text-slate-400 border-transparent hover:text-white"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-md md:max-w-5xl mx-auto px-4 md:px-6 pt-4 pb-28 md:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#131B26] border-t border-[#223147]">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              data-testid={it.testid + "-mobile"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-[52px] px-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider ${
                  isActive ? "text-[#FF5F15]" : "text-slate-400"
                }`
              }
            >
              <it.icon className="w-5 h-5 mb-0.5" />
              {it.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
