export function DifficultyBar({
  easy,
  medium,
  hard,
}: {
  easy: number;
  medium: number;
  hard: number;
}): JSX.Element {
  const total = easy + medium + hard || 1;
  const seg = (n: number, color: string, label: string) =>
    n > 0 ? (
      <div
        className={color}
        style={{ width: `${(n / total) * 100}%` }}
        title={`${label}: ${n}`}
      />
    ) : null;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-hairline">
      {seg(easy, "bg-accent", "Easy")}
      {seg(medium, "bg-data", "Medium")}
      {seg(hard, "bg-danger", "Hard")}
    </div>
  );
}
