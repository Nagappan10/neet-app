import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Subject } from "../lib/types";

interface MeResponse {
  user: {
    id: string;
    username: string;
    displayName: string;
    createdAt: string;
  };
}

// Honest build status — updated as milestones land. No dead tabs, no stubs.
const MODULES: { name: string; milestone: string; ready: boolean; to?: string }[] = [
  { name: "Syllabus & weighting", milestone: "M2", ready: true, to: "/syllabus" },
  { name: "Question bank (PYQ)", milestone: "M2", ready: true, to: "/bank" },
  { name: "Test engine + AI generation", milestone: "M3+M5", ready: true, to: "/tests" },
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
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api<{ subjects: Subject[] }>("/api/syllabus/subjects"),
  });
  const subjects = subjectsData?.subjects ?? [];

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

      {subjects.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
              Syllabus loaded
            </h2>
            <Link to="/syllabus" className="text-sm text-accent hover:underline">
              Explore →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {subjects.map((s) => (
              <Link
                key={s.id}
                to="/syllabus"
                className="rounded-xl border border-hairline bg-surface p-4 transition-colors duration-200 hover:border-muted"
              >
                <p className="text-sm font-medium">{s.name}</p>
                <p className="mt-2 font-mono text-2xl text-ink">{s.chapterCount}</p>
                <p className="text-xs text-muted">chapters · {s.pyqTotal} PYQs</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          Platform build status
        </h2>
        <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
          {MODULES.map((m) => {
            const row = (
              <>
                <span className="text-sm">{m.name}</span>
                <span className="font-mono text-xs text-muted">
                  {m.ready ? <span className="text-accent">live →</span> : `arrives in ${m.milestone}`}
                </span>
              </>
            );
            return (
              <li key={m.name}>
                {m.ready && m.to ? (
                  <Link
                    to={m.to}
                    className="flex items-center justify-between px-5 py-4 transition-colors duration-200 hover:bg-surface-raised"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between px-5 py-4">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Auth, the syllabus matrix, and a verified past-year question bank are live (M0–M2).
          Modules unlock here as each milestone ships — nothing is shown until it actually works.
        </p>
      </section>
    </div>
  );
}
