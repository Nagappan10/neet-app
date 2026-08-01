import { Router } from 'express';
import {
  monthlyWalking,
  practiceWeekly,
  walkingBuckets,
  walkingStreak,
  weeklyWalking,
} from '../aggregates';
import { asyncRoute } from '../middleware';

export const statsRouter: Router = Router();

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Monday of the ISO week containing `date`. */
function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

statsRouter.get(
  '/walking/weekly',
  asyncRoute((req, res) => {
    const raw = String(req.query.start ?? new Date().toISOString().slice(0, 10));
    if (!DAY_RE.test(raw)) {
      res.status(400).json({ error: 'start must be YYYY-MM-DD' });
      return;
    }
    res.json(weeklyWalking(req.userId, weekStart(raw)));
  }),
);

statsRouter.get(
  '/walking/monthly',
  asyncRoute((req, res) => {
    const month = String(req.query.month ?? new Date().toISOString().slice(0, 7));
    if (!MONTH_RE.test(month)) {
      res.status(400).json({ error: 'month must be YYYY-MM' });
      return;
    }
    res.json(monthlyWalking(req.userId, month));
  }),
);

statsRouter.get(
  '/walking/range',
  asyncRoute((req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to)) {
      res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
      return;
    }
    res.json({ days: walkingBuckets(req.userId, from, to), streak: walkingStreak(req.userId) });
  }),
);

statsRouter.get(
  '/practice/weekly',
  asyncRoute((req, res) => {
    const raw = String(req.query.start ?? new Date().toISOString().slice(0, 10));
    if (!DAY_RE.test(raw)) {
      res.status(400).json({ error: 'start must be YYYY-MM-DD' });
      return;
    }
    res.json({ start: weekStart(raw), activities: practiceWeekly(req.userId, weekStart(raw)) });
  }),
);
