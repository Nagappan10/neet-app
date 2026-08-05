import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { DB_PATH } from './db';
import { errorHandler, identify } from './middleware';
import { practiceRouter } from './routes/practice';
import { statsRouter } from './routes/stats';
import { syncRouter } from './routes/sync';
import { walkingRouter } from './routes/walking';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: '8mb' })); // sync batches can be chunky
app.use(morgan('dev'));
app.use(identify);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pulse-server', db: DB_PATH, time: Date.now() });
});

app.use('/api/sync', syncRouter);
app.use('/api/walking', walkingRouter);
app.use('/api/practice', practiceRouter);
app.use('/api/stats', statsRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Pulse API listening on http://localhost:${PORT}  (db: ${DB_PATH})`);
  });
}

export { app };
