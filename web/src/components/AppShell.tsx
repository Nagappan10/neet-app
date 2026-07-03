import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout } from "../lib/api";
import { useAuthStore } from "../lib/authStore";

const NAV: { to: string; label: string }[] = [
  { to: "/", label: "Overview" },
  { to: "/syllabus", label: "Syllabus" },
];

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <span className="font-display text-lg font-semibold tracking-tight">
              NEET<span className="text-accent">·</span>2026
            </span>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
                      isActive ? "text-ink" : "text-muted hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">{user?.displayName}</span>
            <button
              onClick={() => void handleLogout()}
              className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted transition-colors duration-200 hover:border-muted hover:text-ink"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
