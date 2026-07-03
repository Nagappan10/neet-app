import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuthStore } from "./lib/authStore";
import { tryRefresh } from "./lib/api";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { DashboardPage } from "./pages/Dashboard";
import { SyllabusPage } from "./pages/Syllabus";
import { QuestionBankPage } from "./pages/QuestionBank";
import { AppShell } from "./components/AppShell";

function useBootstrap(): boolean {
  const { bootstrapped, setBootstrapped } = useAuthStore();
  useEffect(() => {
    if (bootstrapped) return;
    void tryRefresh().finally(setBootstrapped);
  }, [bootstrapped, setBootstrapped]);
  return bootstrapped;
}

function Protected(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AnonymousOnly(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App(): JSX.Element {
  const bootstrapped = useBootstrap();

  // Hold rendering until the silent session restore settles, so a logged-in
  // user refreshing the page never flashes the login screen.
  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-mono text-sm text-muted">loading…</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AnonymousOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<Protected />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/syllabus" element={<SyllabusPage />} />
        <Route path="/bank" element={<QuestionBankPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
