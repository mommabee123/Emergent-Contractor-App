import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, Users, ListOrdered, Settings, LogOut, Receipt } from "lucide-react";
import { useReceipts } from "../context/ReceiptContext";
import { useAuth } from "../context/AuthContext";

const items = [
  { to: "/", label: "Board", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/jobs", label: "Jobs", icon: Briefcase, testid: "nav-jobs" },
  { to: "/expenses", label: "Expenses", icon: Receipt, testid: "nav-expenses" },
  { to: "/clients", label: "Clients", icon: Users, testid: "nav-clients" },
  { to: "/rate-card", label: "Rates", icon: ListOrdered, testid: "nav-ratecard" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { unsortedCount } = useReceipts();
  const navigate = useNavigate();

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#12110F] text-[#F0EAE2]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#1C1A17] border-b border-[#2B2823]">
        <div className="max-w-md md:max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-[#F5F1EA] rotate-45 inline-block" />
            <span className="font-industrial text-xl font-bold uppercase tracking-wider">Jobsite</span>
          </div>
          <button
            data-testid="logout-button"
            onClick={doLogout}
            className="tap-min px-3 text-[#A39990] hover:text-[#F0EAE2] flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{user?.email}</span>
          </button>
        </div>
      </header>

      {/* Desktop nav */}
      <nav className="hidden md:block bg-[#1C1A17] border-b border-[#2B2823]">
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
                    ? "text-[#2F7DE1] border-[#2F7DE1]"
                    : "text-[#A39990] border-transparent hover:text-[#F0EAE2]"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
              {it.to === "/expenses" && unsortedCount > 0 && <span data-testid="nav-expenses-unsorted-desktop">{unsortedCount}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-md md:max-w-5xl mx-auto px-4 md:px-6 pt-4 pb-44 md:pb-28">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1C1A17] border-t border-[#2B2823]">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              data-testid={it.testid + "-mobile"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-[52px] px-1 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                  isActive ? "text-[#2F7DE1]" : "text-[#A39990]"
                }`
              }
            >
              <span className="relative"><it.icon className="w-5 h-5 mb-0.5" />
                {it.to === "/expenses" && unsortedCount > 0 && <span data-testid="nav-expenses-unsorted-mobile" className="absolute -right-3 -top-1 px-1 rounded bg-[#2F7DE1] text-[#F0EAE2]">{unsortedCount}</span>}
              </span>
              {it.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
