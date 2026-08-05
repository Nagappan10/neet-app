import { z } from 'zod';

/** Every syncable record carries these fields. */
const syncBase = {
  id: z.string().min(1),
  deleted: z.union([z.boolean(), z.number()]).optional().default(0),
  updated_at: z.number().int().nonnegative(),
};

export const walkingSessionSchema = z.object({
  ...syncBase,
  started_at: z.number().int(),
  ended_at: z.number().int().nullable().optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().nonnegative().default(0),
  duration_ms: z.number().int().nonnegative().default(0),
  distance_m: z.number().nonnegative().default(0),
  calories: z.number().nonnegative().default(0),
  avg_pace: z.number().nonnegative().default(0),
  note: z.string().nullable().optional(),
});

export const dailyStepsSchema = z.object({
  ...syncBase,
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  steps: z.number().int().nonnegative().default(0),
  distance_m: z.number().nonnegative().default(0),
  calories: z.number().nonnegative().default(0),
  active_ms: z.number().int().nonnegative().default(0),
  goal: z.number().int().positive().default(10000),
});

export const practiceActivitySchema = z.object({
  ...syncBase,
  name: z.string().min(1).max(60),
  icon: z.string().default('sparkles'),
  color: z.string().default('#8B5CF6'),
  target_minutes: z.number().int().positive().default(20),
  sort_order: z.number().int().default(0),
  archived: z.union([z.boolean(), z.number()]).default(0),
  created_at: z.number().int(),
});

export const practiceSessionSchema = z.object({
  ...syncBase,
  activity_id: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  started_at: z.number().int(),
  ended_at: z.number().int().nullable().optional(),
  minutes: z.number().nonnegative().default(0),
  source: z.enum(['timer', 'manual']).default('timer'),
  note: z.string().nullable().optional(),
});

export const syncRequestSchema = z.object({
  since: z.number().int().nonnegative().default(0),
  push: z
    .object({
      walking_sessions: z.array(walkingSessionSchema).default([]),
      daily_steps: z.array(dailyStepsSchema).default([]),
      practice_activities: z.array(practiceActivitySchema).default([]),
      practice_sessions: z.array(practiceSessionSchema).default([]),
    })
    .default({
      walking_sessions: [],
      daily_steps: [],
      practice_activities: [],
      practice_sessions: [],
    }),
});

export type WalkingSession = z.infer<typeof walkingSessionSchema>;
export type DailySteps = z.infer<typeof dailyStepsSchema>;
export type PracticeActivity = z.infer<typeof practiceActivitySchema>;
export type PracticeSession = z.infer<typeof practiceSessionSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;

/** SQLite has no boolean type; normalise everything to 0/1. */
export const bit = (v: boolean | number | undefined): number => (v ? 1 : 0);
