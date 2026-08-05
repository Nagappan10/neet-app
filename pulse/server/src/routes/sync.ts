import { Router } from 'express';
import { db } from '../db';
import { asyncRoute } from '../middleware';
import {
  changedSince,
  saveActivity,
  saveDailySteps,
  savePracticeSession,
  saveWalkingSession,
} from '../repo';
import { syncRequestSchema } from '../types';

export const syncRouter: Router = Router();

/**
 * One round trip does both halves of a sync:
 *   push — client changes since its last successful sync, merged last-write-wins
 *   pull — everything on the server newer than the client's watermark
 *
 * The whole push is one transaction so a partial failure never leaves the
 * server holding half a batch.
 */
syncRouter.post(
  '/',
  asyncRoute((req, res) => {
    const parsed = syncRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid sync payload', details: parsed.error.flatten() });
      return;
    }

    const { since, push } = parsed.data;
    const userId = req.userId;

    const applyAll = db.transaction(() => {
      for (const row of push.walking_sessions) saveWalkingSession(userId, row);
      for (const row of push.daily_steps) saveDailySteps(userId, row);
      for (const row of push.practice_activities) saveActivity(userId, row);
      for (const row of push.practice_sessions) savePracticeSession(userId, row);
    });

    applyAll();

    res.json({
      server_time: Date.now(),
      pushed: {
        walking_sessions: push.walking_sessions.length,
        daily_steps: push.daily_steps.length,
        practice_activities: push.practice_activities.length,
        practice_sessions: push.practice_sessions.length,
      },
      pull: changedSince(userId, since),
    });
  }),
);
