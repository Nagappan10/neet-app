import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../lib/api";
import { useAuthStore } from "../lib/authStore";

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
          <span className="font-display text-lg font-semibold tracking-tight">
            NEET<span className="text-accent">·</span>2026
          </span>
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
