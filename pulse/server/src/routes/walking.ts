import { Router } from 'express';
import { db } from '../db';
import { asyncRoute } from '../middleware';
import { getById, listAll, saveDailySteps, saveWalkingSession, softDelete } from '../repo';
import { dailyStepsSchema, walkingSessionSchema } from '../types';

export const walkingRouter: Router = Router();

walkingRouter.get(
  '/sessions',
  asyncRoute((req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const rows = db
      .prepare(
        `SELECT * FROM walking_sessions
          WHERE user_id = ? AND deleted = 0
          ORDER BY started_at DESC LIMIT ?`,
      )
      .all(req.userId, limit);
    res.json({ sessions: rows });
  }),
);

walkingRouter.get(
  '/sessions/:id',
  asyncRoute((req, res) => {
    const row = getById('walking_sessions', req.userId, req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(row);
  }),
);

walkingRouter.post(
  '/sessions',
  asyncRoute((req, res) => {
    const parsed = walkingSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid session', details: parsed.error.flatten() });
      return;
    }
    saveWalkingSession(req.userId, parsed.data);
    res.status(201).json(getById('walking_sessions', req.userId, parsed.data.id));
  }),
);

walkingRouter.delete(
  '/sessions/:id',
  asyncRoute((req, res) => {
    const ok = softDelete('walking_sessions', req.userId, req.params.id);
    res.status(ok ? 204 : 404).end();
  }),
);

walkingRouter.get(
  '/daily',
  asyncRoute((req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };
    if (from && to) {
      const rows = db
        .prepare(
          `SELECT * FROM daily_steps
            WHERE user_id = ? AND deleted = 0 AND day BETWEEN ? AND ?
            ORDER BY day ASC`,
        )
        .all(req.userId, from, to);
      res.json({ days: rows });
      return;
    }
    res.json({ days: listAll('daily_steps', req.userId) });
  }),
);

walkingRouter.put(
  '/daily/:day',
  asyncRoute((req, res) => {
    const parsed = dailyStepsSchema.safeParse({
      ...req.body,
      day: req.params.day,
      // Matches the deterministic id the app generates, so a REST write and a
      // synced write for the same day converge on one row.
      id: req.body?.id ?? `day:${req.params.day}`,
      updated_at: req.body?.updated_at ?? Date.now(),
    });
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid daily row', details: parsed.error.flatten() });
      return;
    }
    saveDailySteps(req.userId, parsed.data);
    res.json(getById('daily_steps', req.userId, parsed.data.id));
  }),
);
