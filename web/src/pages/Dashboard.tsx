import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface MeResponse {
  user: {
    id: string;
    username: string;
    displayName: string;
    createdAt: string;
  };
}

// Honest build status — updated as milestones land. No dead tabs, no stubs.
const MODULES: { name: string; milestone: string; ready: boolean }[] = [
  { name: "Question bank", milestone: "M4", ready: false },
  { name: "Exam engine", milestone: "M5", ready: false },
  { name: "Shortnotes", milestone: "M6", ready: false },
  { name: "Flowcharts", milestone: "M6", ready: false },
  { name: "Flashcards", milestone: "M6", ready: false },
  { name: "Progress & rankboard", milestone: "M7", ready: false },
];

export function DashboardPage(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MeResponse>("/api/me"),
  });

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isLoading ? "…" : `Hey, ${data?.user.displayName}`}
        </h1>
        {data && (
          <p className="mt-2 text-sm text-muted">
            Signed in as <span className="font-mono text-ink">@{data.user.username}</span> · member
            since{" "}
            {new Date(data.user.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Platform build status
        </h2>
        <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {MODULES.map((m) => (
            <li key={m.name} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm">{m.name}</span>
              <span className="font-mono text-xs text-muted">
                {m.ready ? (
                  <span className="text-accent">live</span>
                ) : (
                  `arrives in ${m.milestone}`
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Auth and per-user persistence are live (M0–M1). Modules unlock here as each milestone
          ships — nothing is shown until it actually works.
        </p>
      </section>
    </div>
  );
}
