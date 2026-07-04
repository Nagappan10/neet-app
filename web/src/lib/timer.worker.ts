/// <reference lib="webworker" />
// Countdown timer in a Web Worker so it never drifts or freezes when the main
// thread / tab is throttled (SPEC §6.3). Ticks every 250ms off an absolute
// end time and posts the remaining seconds; posts "done" at zero.

let endTime = 0;
let handle: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  const remainingMs = Math.max(0, endTime - Date.now());
  const remainingSec = Math.ceil(remainingMs / 1000);
  (self as unknown as Worker).postMessage({ type: "tick", remainingSec });
  if (remainingMs <= 0 && handle) {
    clearInterval(handle);
    handle = null;
    (self as unknown as Worker).postMessage({ type: "done" });
  }
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data as { type: string; durationSec?: number };
  if (data.type === "start" && typeof data.durationSec === "number") {
    endTime = Date.now() + data.durationSec * 1000;
    if (handle) clearInterval(handle);
    tick();
    handle = setInterval(tick, 250);
  } else if (data.type === "stop" && handle) {
    clearInterval(handle);
    handle = null;
  }
};
