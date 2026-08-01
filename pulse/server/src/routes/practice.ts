import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { asyncRoute } from '../middleware';
import { getById, listAll, saveActivity, savePracticeSession, softDelete } from '../repo';
import { practiceActivitySchema, practiceSessionSchema } from '../types';

export const practiceRouter: Router = Router();

/* ---------------------------------- activities --------------------------- */

practiceRouter.get(
  '/activities',
  asyncRoute((req, res) => {
    const rows = db
      .prepare(
        `SELECT * FROM practice_activities
          WHERE user_id = ? AND deleted = 0
          ORDER BY archived ASC, sort_order ASC, created_at ASC`,
      )
      .all(req.userId);
    res.json({ activities: rows });
  }),
);

practiceRouter.post(
  '/activities',
  asyncRoute((req, res) => {
    const now = Date.now();
    const parsed = practiceActivitySchema.safeParse({
      id: randomUUID(),
      created_at: now,
      updated_at: now,
      ...req.body,
    });
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid activity', details: parsed.error.flatten() });
      return;
    }
    saveActivity(req.userId, parsed.data);
    res.status(201).json(getById('practice_activities', req.userId, parsed.data.id));
  }),
);

practiceRouter.patch(
  '/activities/:id',
  asyncRoute((req, res) => {
    const existing = getById('practice_activities', req.userId, req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }
    const parsed = practiceActivitySchema.safeParse({
      ...(existing as object),
      ...req.body,
      id: req.params.id,
      updated_at: Date.now(),
    });
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid activity', details: parsed.error.flatten() });
      return;
    }
    saveActivity(req.userId, parsed.data);
    res.json(getById('practice_activities', req.userId, req.params.id));
  }),
);

practiceRouter.delete(
  '/activities/:id',
  asyncRoute((req, res) => {
    const ok = softDelete('practice_activities', req.userId, req.params.id);
    res.status(ok ? 204 : 404).end();
  }),
);

/* ---------------------------------- sessions ----------------------------- */

practiceRouter.get(
  '/sessions',
  asyncRoute((req, res) => {
    const { activity_id: activityId, limit } = req.query as {
      activity_id?: string;
      limit?: string;
    };
    const max = Math.min(Number(limit ?? 200), 1000);

    const rows = activityId
      ? db
          .prepare(
            `SELECT * FROM practice_sessions
              WHERE user_id = ? AND deleted = 0 AND activity_id = ?
              ORDER BY started_at DESC LIMIT ?`,
          )
          .all(req.userId, activityId, max)
      : db
          .prepare(
            `SELECT * FROM practice_sessions
              WHERE user_id = ? AND deleted = 0
              ORDER BY started_at DESC LIMIT ?`,
          )
          .all(req.userId, max);

    res.json({ sessions: rows });
  }),
);

practiceRouter.post(
  '/sessions',
  asyncRoute((req, res) => {
    const now = Date.now();
    const parsed = practiceSessionSchema.safeParse({
      id: randomUUID(),
      updated_at: now,
      started_at: now,
      ...req.body,
    });
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid practice session', details: parsed.error.flatten() });
      return;
    }
    savePracticeSession(req.userId, parsed.data);
    res.status(201).json(getById('practice_sessions', req.userId, parsed.data.id));
  }),
);

practiceRouter.delete(
  '/sessions/:id',
  asyncRoute((req, res) => {
    const ok = softDelete('practice_sessions', req.userId, req.params.id);
    res.status(ok ? 204 : 404).end();
  }),
);

/** Convenience listing used by the overview screen. */
practiceRouter.get(
  '/overview',
  asyncRoute((req, res) => {
    res.json({ activities: listAll('practice_activities', req.userId) });
  }),
);
