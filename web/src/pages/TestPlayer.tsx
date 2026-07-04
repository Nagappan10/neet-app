import { useState } from "react";
import type { BuiltTest, Scorecard } from "../lib/types";
import { api } from "../lib/api";
import { formatTime, useCountdown } from "../lib/useCountdown";

export function TestPlayer({
  test,
  onSubmitted,
}: {
  test: BuiltTest;
  onSubmitted: (score: Scorecard) => void;
}): JSX.Element {
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const q = test.questions[current]!;

  async function submit(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    try {
      const score = await api<Scorecard>(`/api/tests/${test.attemptId}/submit`, {
        method: "POST",
        body: JSON.stringify({ responses }),
      });
      onSubmitted(score);
    } catch {
      setSubmitting(false);
    }
  }

  // Auto-submit on timeout is wired through the worker countdown.
  const remaining = useCountdown(test.durationSec, () => void submit());
  const low = remaining <= 60;

  const answeredCount = Object.keys(responses).length;

  function choose(idx: number): void {
    setResponses((r) => ({ ...r, [q.id]: idx }));
  }
  function toggleMark(): void {
    setMarked((m) => {
      const next = new Set(m);
      next.has(q.id) ? next.delete(q.id) : next.add(q.id);
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{test.name}</h1>
            <p className="text-xs text-muted">
              Question {current + 1} of {test.questions.length} · {q.subject.name}
            </p>
          </div>
          <div
            className={`rounded-lg border px-3 py-1.5 font-mono text-lg tabular-nums ${
              low ? "border-danger text-danger" : "border-hairline text-ink"
            }`}
          >
            {formatTime(remaining)}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{q.stem}</p>
          <ul className="mt-4 space-y-2">
            {q.options.map((opt, i) => {
              const chosen = responses[q.id] === i;
              return (
                <li key={i}>
                  <button
                    onClick={() => choose(i)}
                    className={`flex w-full items-start gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors duration-200 ${
                      chosen ? "border-accent bg-accent/10" : "border-hairline hover:border-muted"
                    }`}
                  >
                    <span className="font-mono text-xs text-muted">{"1234"[i]}</span>
                    <span className="flex-1">{opt}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => setResponses((r) => { const n = { ...r }; delete n[q.id]; return n; })}
              className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              Clear response
            </button>
            <button
              onClick={toggleMark}
              className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              {marked.has(q.id) ? "Unmark" : "Mark for review"}
            </button>
            <div className="ml-auto flex gap-2">
              <button
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
                className="rounded-md border border-hairline px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={current === test.questions.length - 1}
                onClick={() => setCurrent((c) => c + 1)}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-40"
              >
                Save &amp; next
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-hairline bg-surface p-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted">Navigator</p>
          <div className="grid grid-cols-6 gap-1.5">
            {test.questions.map((tq, i) => {
              const answered = responses[tq.id] !== undefined;
              const isMarked = marked.has(tq.id);
              let cls = "border-hairline text-muted";
              if (isMarked && answered) cls = "border-data bg-data/20 text-ink";
              else if (isMarked) cls = "border-data text-data";
              else if (answered) cls = "border-accent bg-accent/20 text-ink";
              if (i === current) cls += " ring-2 ring-accent";
              return (
                <button
                  key={tq.id}
                  onClick={() => setCurrent(i)}
                  className={`aspect-square rounded border font-mono text-xs transition-colors duration-150 ${cls}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-1 text-[11px] text-muted">
            <p><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent" />answered</p>
            <p><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-data" />marked</p>
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface p-4 text-sm">
          <p className="text-muted">
            Answered <span className="font-mono text-ink">{answeredCount}</span> / {test.questions.length}
          </p>
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="mt-3 w-full rounded-md bg-accent px-4 py-2 font-medium text-accent-ink hover:opacity-90"
            >
              Submit test
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted">Submit now? This can't be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "…" : "Yes, submit"}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="rounded-md border border-hairline px-3 py-2 text-sm text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
