import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Chapter, Subject } from "../lib/types";
import { DifficultyBar } from "../components/DifficultyBar";

export function SyllabusPage(): JSX.Element {
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => api<{ subjects: Subject[] }>("/api/syllabus/subjects"),
  });
  const subjects = subjectsData?.subjects ?? [];
  const [active, setActive] = useState<string | null>(null);
  const activeId = active ?? subjects[0]?.id ?? null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Syllabus &amp; weighting</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Chapters and their exam weighting, parsed from the NEET 2020–2025 chapter-wise analysis.
          Weighting is the number of questions that chapter contributed across those years — sort
          your prep by what actually gets tested.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => {
          const on = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors duration-200 ${
                on
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-hairline text-muted hover:border-muted hover:text-ink"
              }`}
            >
              {s.name}
              <span className="ml-2 font-mono text-xs text-muted">
                {s.chapterCount}ch · {s.pyqTotal}q
              </span>
            </button>
          );
        })}
      </div>

      {activeId && <ChapterList subjectId={activeId} />}
    </div>
  );
}

function ChapterList({ subjectId }: { subjectId: string }): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ["chapters", subjectId],
    queryFn: () => api<{ chapters: Chapter[] }>(`/api/syllabus/subjects/${subjectId}/chapters`),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <p className="font-mono text-sm text-muted">loading chapters…</p>;
  const chapters = data?.chapters ?? [];
  const maxWeight = Math.max(1, ...chapters.map((c) => c.weighting));

  return (
    <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface">
      {chapters.map((c) => {
        const open = openId === c.id;
        const diff = c.analysis?.difficulty;
        return (
          <li key={c.id}>
            <button
              onClick={() => setOpenId(open ? null : c.id)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-200 hover:bg-surface-raised"
            >
              <span className="w-10 shrink-0 font-mono text-xs text-muted">{c.weighting}q</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{c.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  {c.topics.length} topics
                  {diff ? ` · ${diff.easy}E / ${diff.medium}M / ${diff.hard}H` : ""}
                </span>
              </span>
              <span className="hidden w-40 shrink-0 sm:block">
                {/* PYQ frequency, scaled to the heaviest chapter in the subject */}
                <span className="block h-1.5 overflow-hidden rounded-full bg-hairline">
                  <span
                    className="block h-full bg-accent"
                    style={{ width: `${(c.weighting / maxWeight) * 100}%` }}
                  />
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">{open ? "−" : "+"}</span>
            </button>

            {open && c.analysis && (
              <div className="space-y-4 border-t border-hairline bg-bg/40 px-5 py-5">
                {c.analysis.summary && (
                  <p className="text-sm leading-relaxed text-ink/90">{c.analysis.summary}</p>
                )}
                {diff && (
                  <div className="max-w-md space-y-1.5">
                    <DifficultyBar easy={diff.easy} medium={diff.medium} hard={diff.hard} />
                    <div className="flex justify-between font-mono text-[11px] text-muted">
                      <span className="text-accent">{diff.easy} easy</span>
                      <span className="text-data">{diff.medium} medium</span>
                      <span className="text-danger">{diff.hard} hard</span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-xs uppercase tracking-widest text-muted">
                    Topics tested (by PYQ frequency)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...c.analysis.topicDetail]
                      .sort((a, b) => b.total - a.total)
                      .map((t) => (
                        <span
                          key={t.name}
                          className="rounded-md border border-hairline bg-surface px-2 py-1 text-xs text-muted"
                        >
                          {t.name}
                          <span className="ml-1.5 font-mono text-[10px] text-accent">{t.total}</span>
                        </span>
                      ))}
                  </div>
                </div>
                {c.analysis.insights.length > 0 && (
                  <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-muted">
                    {c.analysis.insights.map((ins, i) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
