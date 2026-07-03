import type { FormEvent, ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  onSubmit,
  error,
  busy,
  submitLabel,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  footer: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-display text-xl font-semibold tracking-tight">
          NEET<span className="text-accent">·</span>2026
        </p>
        <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {children}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-accent px-4 py-2.5 font-medium text-accent-ink transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "…" : submitLabel}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <input
        {...props}
        className="w-full rounded-md border border-hairline bg-bg px-3 py-2.5 text-ink outline-none transition-colors duration-200 placeholder:text-muted/60 focus:border-accent"
      />
    </label>
  );
}
