import { useEffect, useRef, useState } from "react";

/**
 * Drives a Web-Worker countdown. Returns the remaining seconds; calls onExpire
 * once when it hits zero. The worker keeps ticking even if this tab is
 * throttled, so the exam timer never freezes.
 */
export function useCountdown(durationSec: number, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(durationSec);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    const worker = new Worker(new URL("./timer.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as { type: string; remainingSec?: number };
      if (data.type === "tick" && typeof data.remainingSec === "number") {
        setRemaining(data.remainingSec);
      } else if (data.type === "done" && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };
    worker.postMessage({ type: "start", durationSec });
    return () => {
      worker.postMessage({ type: "stop" });
      worker.terminate();
    };
  }, [durationSec]);

  return remaining;
}

export function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
