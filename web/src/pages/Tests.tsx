import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import type {
  AttemptSummary,
  BuiltTest,
  Chapter,
  ReviewItem,
  Scorecard,
  Subject,
} from "../lib/types";
import { TestPlayer } from "./TestPlayer";

type Mode = "builder" | "playing" | "result";

const DURATION_PRESETS = [20, 30, 45, 60, 90, 180, 200];

export function TestsPage(): JSX.Element {
  const [mode, setMode] = useState<Mode>("builder");
  const [test, setTest] = useState<BuiltTest | null>(null);
  const [score, setScore] = useState<Scorecard | null>(null);

  if (mode === "playing" && test) {
    return (
      <TestPlayer
        test={test}
        onSubmitted={(s) => {
          setScore(s);
          setMode("result");
        }}
      />
    );
  }

  if (mode === "result" && score) {
    return (
      <TestResult
        score={score}
        onDone={() => {
          setScore(null);
          setTest(null);
          setMode("builder");
        }}
      />
    );
  }

  return (
    <TestBuilder
      onStart={(t) => {
        setTest(t);
        setMode("playing");
      }}
    />
  );
}

// NEET UG: 45 questions per subject, 180 total, 720 marks, 180 minutes (2025 pattern).
const MOCK_PER_SUBJECT = 45;
const MOCK_DEFAULT_MIN = 180;

function TestBuilder({ onStart }: { onStart: (t: BuiltTest) => void }): JSX.Element {
  const qc = useQueryClient();
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api<{ subjects: Subject[] }>("/api/syllabus/subjects"),
  });
  const { data: agentStatus } = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => api<{ configured: boolean }>("/api/agent/status"),
  });
  const { data: stats } = useQuery({
    queryKey: ["bank-stats"],
    queryFn: () => api<{ total: number; bySubject: Record<string, number> }>("/api/questions/stats"),
  });
  const subjects = subjectsData?.subjects ?? [];

  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [count, setCount] = useState(10);
  const [duration, setDuration] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [mockMinutes, setMockMinutes] = useState(MOCK_DEFAULT_MIN);
  const [mockBusy, setMockBusy] = useState(false);

  async function startMock(): Promise<void> {
    setError(null);
    setMockBusy(true);
    try {
      const sections = subjects.map((s) => ({ subjectId: s.id, count: MOCK_PER_SUBJECT }));
      const t = await api<BuiltTest>("/api/tests/build", {
        method: "POST",
        body: JSON.stringify({
          mode: "full_mock",
          name: "Full NEET Mock",
          sections,
          durationSec: mockMinutes * 60,
        }),
      });
      onStart(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not build the mock");
    } finally {
      setMockBusy(false);
    }
  }

  const { data: chaptersData } = useQuery({
    queryKey: ["chapters", subjectId],
    queryFn: () => api<{ chapters: Chapter[] }>(`/api/syllabus/subjects/${subjectId}/chapters`),
    enabled: !!subjectId,
  });
  const chapters = chaptersData?.chapters ?? [];

  async function build(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { count, durationSec: duration * 60 };
      if (chapterId) body.chapterIds = [chapterId];
      else if (subjectId) body.subjectId = subjectId;
      const t = await api<BuiltTest>("/api/tests/build", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onStart(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not build the test");
    } finally {
      setBusy(false);
    }
  }

  async function generate(): Promise<void> {
    if (!chapterId) return;
    setGenMsg(null);
    setGenBusy(true);
    try {
      const r = await api<{ created: number; requested: number }>(
        "/api/agent/generate-questions",
        { method: "POST", body: JSON.stringify({ chapterId, count: 5, difficulty: "mixed" }) },
      );
      setGenMsg(`Generated and validated ${r.created} new question${r.created === 1 ? "" : "s"}.`);
      void qc.invalidateQueries({ queryKey: ["questions"] });
    } catch (err) {
      setGenMsg(err instanceof ApiError ? err.message : "Generation failed");
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tests</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Build a timed test from any subject or chapter, or sit the full mock. Duration is fully
          yours — pick a preset or type any minutes. Marking is NEET-standard: +4 correct, −1 wrong,
          0 skipped.
        </p>
      </header>

      {/* Flagship: the real NEET sitting. */}
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Full NEET Mock</h2>
            <p className="mt-1 text-sm text-muted">
              180 questions · 720 marks · 45 each from Physics, Chemistry, Botany, Zoology.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
              {subjects.map((s) => {
                const have = stats?.bySubject[s.id] ?? 0;
                const ready = have >= MOCK_PER_SUBJECT;
                return (
                  <span key={s.id} className={ready ? "text-accent" : ""}>
                    {s.name}: {Math.min(have, MOCK_PER_SUBJECT)}/{MOCK_PER_SUBJECT}
                  </span>
                );
              })}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">Minutes</span>
              <input
                type="number"
                min={1}
                value={mockMinutes}
                onChange={(e) => setMockMinutes(Math.max(1, Number(e.target.value)))}
                className="w-20 rounded-md border border-hairline bg-bg px-2 py-2 font-mono text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <button
              onClick={() => void startMock()}
              disabled={mockBusy || subjects.length === 0}
              className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
            >
              {mockBusy ? "Building…" : "Start Full Mock"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted/70">
          Uses however many validated questions are in the bank. For the true 180-question sitting,
          fill each chapter to 45 with the batch generator (see README) — the counts above turn
          green as subjects fill up.
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted">
          Custom test
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Subject</span>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setChapterId("");
                setGenMsg(null);
              }}
              className="w-full rounded-md border border-hairline bg-bg px-3 py-2.5 text-ink outline-none focus:border-accent"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Chapter (optional)</span>
            <select
              value={chapterId}
              onChange={(e) => {
                setChapterId(e.target.value);
                setGenMsg(null);
              }}
              disabled={!subjectId}
              className="w-full rounded-md border border-hairline bg-bg px-3 py-2.5 text-ink outline-none focus:border-accent disabled:opacity-50"
            >
              <option value="">Any chapter in subject</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Number of questions</span>
            <input
              type="number"
              min={1}
              max={180}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(180, Number(e.target.value))))}
              className="w-full rounded-md border border-hairline bg-bg px-3 py-2.5 font-mono text-ink outline-none focus:border-accent"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-sm text-muted">Duration (minutes)</span>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDuration(p)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs ${
                    duration === p
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-hairline text-muted hover:text-ink"
                  }`}
                >
                  {p}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                className="w-20 rounded-md border border-hairline bg-bg px-2 py-1 font-mono text-xs text-ink outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void build()}
            disabled={busy}
            className="rounded-md bg-accent px-5 py-2.5 font-medium text-accent-ink hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Building…" : "Start test"}
          </button>

          {/* Per-lesson AI generation feeds the bank for the selected chapter. */}
          {chapterId && (
            <button
              onClick={() => void generate()}
              disabled={genBusy || !agentStatus?.configured}
              title={
                agentStatus?.configured
                  ? "Generate 5 fresh AI questions for this chapter"
                  : "Set AI_API_KEY in .env to enable generation"
              }
              className="rounded-md border border-hairline px-4 py-2.5 text-sm text-muted transition-colors duration-200 hover:border-muted hover:text-ink disabled:opacity-50"
            >
              {genBusy ? "Generating…" : "✦ Generate 5 with AI"}
            </button>
          )}
          {genMsg && <span className="text-sm text-muted">{genMsg}</span>}
        </div>
        {chapterId && !agentStatus?.configured && (
          <p className="mt-2 text-xs text-muted/70">
            AI generation is off until you add an <span className="font-mono">AI_API_KEY</span> to
            your <span className="font-mono">.env</span>.
          </p>
        )}
      </div>

      <TestHistory />
    </div>
  );
}

function TestHistory(): JSX.Element {
  const { data } = useQuery({
    queryKey: ["test-history"],
    queryFn: () => api<{ attempts: AttemptSummary[] }>("/api/tests/history"),
  });
  const attempts = data?.attempts ?? [];
  if (attempts.length === 0) return <></>;

  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Your history</h2>
      <ul className="mt-4 divide-y divide-hairline rounded-xl border border-hairline bg-surface">
        {attempts.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm">{a.name}</p>
              <p className="text-xs text-muted">
                {new Date(a.submittedAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {a.correct}✓ {a.wrong}✗ {a.unattempted}○
              </p>
            </div>
            <span className="font-mono text-lg text-accent">{a.score}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TestResult({ score, onDone }: { score: Scorecard; onDone: () => void }): JSX.Element {
  const { data } = useQuery({
    queryKey: ["review", score.attemptId],
    queryFn: () =>
      api<{ review: ReviewItem[] }>(`/api/tests/${score.attemptId}/review`),
  });
  const review = data?.review ?? [];
  const accuracy =
    score.correct + score.wrong > 0
      ? Math.round((score.correct / (score.correct + score.wrong)) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Scorecard</h1>
        <button
          onClick={onDone}
          className="rounded-md border border-hairline px-4 py-2 text-sm text-muted hover:text-ink"
        >
          New test
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Score" value={`${score.score}`} sub={`/ ${score.maxScore}`} accent />
        <Stat label="Correct" value={`${score.correct}`} sub={`of ${score.total}`} />
        <Stat label="Wrong" value={`${score.wrong}`} sub="−1 each" />
        <Stat label="Accuracy" value={`${accuracy}%`} sub={`${score.unattempted} skipped`} />
      </div>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted">Review</h2>
        <ul className="space-y-4">
          {review.map((item, idx) => {
            const correct = item.chosenIndex === item.correctIndex;
            const skipped = item.chosenIndex === null;
            return (
              <li key={item.id} className="rounded-xl border border-hairline bg-surface p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">#{idx + 1}</span>
                  <span className="rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
                    {item.subject.name}
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      skipped ? "text-muted" : correct ? "text-accent" : "text-danger"
                    }`}
                  >
                    {skipped ? "skipped" : correct ? "correct" : "wrong"}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{item.stem}</p>
                <ul className="mt-3 space-y-1.5">
                  {item.options.map((opt, i) => {
                    const isCorrect = i === item.correctIndex;
                    const isChosen = i === item.chosenIndex;
                    let cls = "border-hairline text-muted";
                    if (isCorrect) cls = "border-accent bg-accent/10 text-ink";
                    else if (isChosen) cls = "border-danger bg-danger/10 text-ink";
                    return (
                      <li
                        key={i}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-1.5 text-sm ${cls}`}
                      >
                        <span className="font-mono text-xs text-muted">{"1234"[i]}</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <span className="text-accent">✓</span>}
                        {isChosen && !isCorrect && <span className="text-danger">✗</span>}
                      </li>
                    );
                  })}
                </ul>
                {item.explanation && (
                  <p className="mt-3 rounded-lg border border-hairline bg-bg/40 px-3 py-2 text-xs leading-relaxed text-muted">
                    {item.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-2 font-mono text-2xl ${accent ? "text-accent" : "text-ink"}`}>{value}</p>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}
