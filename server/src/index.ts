import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env, isProd } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { syllabusRouter } from "./routes/syllabus.js";
import { questionsRouter } from "./routes/questions.js";
import { agentRouter } from "./routes/agent.js";
import { testsRouter } from "./routes/tests.js";
import { errorHandler } from "./middleware/error.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // rate limiter + secure cookies behind a proxy

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/syllabus", syllabusRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/agent", agentRouter);
app.use("/api/tests", testsRouter);

// In production the built React app is served from the same process,
// making this a single deployable full-stack app.
if (isProd) {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(dirname, "../../web/dist");
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
