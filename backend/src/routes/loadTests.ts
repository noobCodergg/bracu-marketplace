import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { internalLoadTestSecret } from "../middleware/userRateLimiter.js";

type Job = {
  id: string;
  path: string;
  total: number;
  concurrency: number;
  completed: number;
  succeeded: number;
  failed: number;
  status: "RUNNING" | "COMPLETED" | "STOPPED";
  startedAt: string;
  finishedAt?: string;
  latencies: number[];
  statusCodes: Record<string, number>;
  errors: Record<string, number>;
  stopped: boolean;
};
const jobs = new Map<string, Job>();
const router = Router();
const inputSchema = z
  .object({
    path: z
      .string()
      .trim()
      .regex(/^\/api\/v1\/[a-zA-Z0-9/_?=&.%:-]+$/)
      .max(300)
      .refine(
        (path) =>
          !path.includes("/load-tests") &&
          !path.includes("/notifications/stream"),
        "This endpoint cannot be load tested",
      ),
    total: z.coerce.number().int().min(1).max(20000),
    concurrency: z.coerce.number().int().min(1).max(200),
  })
  .refine((value) => value.concurrency <= value.total, {
    message: "Concurrency cannot exceed total requests",
    path: ["concurrency"],
  });
const percentile = (values: number[], p: number) =>
  values.length
    ? values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)]!
    : 0;
const view = (job: Job) => {
  const sorted = [...job.latencies].sort((a, b) => a - b),
    elapsed =
      ((job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now()) -
        new Date(job.startedAt).getTime()) /
      1000;
  return {
    id: job.id,
    path: job.path,
    total: job.total,
    concurrency: job.concurrency,
    completed: job.completed,
    succeeded: job.succeeded,
    failed: job.failed,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    progress: Math.round((job.completed / job.total) * 100),
    requestsPerSecond: elapsed
      ? Math.round((job.completed / elapsed) * 100) / 100
      : 0,
    latency: {
      average: sorted.length
        ? Math.round(
            (sorted.reduce((sum, value) => sum + value, 0) / sorted.length) *
              100,
          ) / 100
        : 0,
      min: sorted[0] ?? 0,
      max: sorted.at(-1) ?? 0,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
    },
    statusCodes: job.statusCodes,
    errors: job.errors,
  };
};

async function run(job: Job, cookie: string) {
  let cursor = 0;
  const worker = async (workerIndex: number) => {
    while (!job.stopped) {
      const index = cursor++;
      if (index >= job.total) return;
      const started = performance.now();
      try {
        const response = await fetch(
          `http://127.0.0.1:${env.PORT}${job.path}`,
          {
            headers: {
              cookie,
              "X-Load-Test": job.id,
              "X-Visitor-Id": `load-test-${job.id}-${workerIndex}`,
              "X-Load-Test-User": `${job.id}-${workerIndex}`,
              "X-Internal-Load-Test-Secret": internalLoadTestSecret,
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        await response.arrayBuffer();
        job.statusCodes[String(response.status)] =
          (job.statusCodes[String(response.status)] ?? 0) + 1;
        if (response.ok) job.succeeded++;
        else job.failed++;
      } catch (error) {
        job.failed++;
        const name = error instanceof Error ? error.name : "RequestError";
        job.errors[name] = (job.errors[name] ?? 0) + 1;
      } finally {
        job.latencies.push(
          Math.round((performance.now() - started) * 100) / 100,
        );
        job.completed++;
      }
    }
  };
  await Promise.all(
    Array.from({ length: job.concurrency }, (_, workerIndex) =>
      worker(workerIndex),
    ),
  );
  job.status = job.stopped ? "STOPPED" : "COMPLETED";
  job.finishedAt = new Date().toISOString();
}

router.use(requireAuth, requireRole("ADMIN"));
router.post("/", (req, res, next) => {
  try {
    const input = inputSchema.parse(req.body);
    const running = [...jobs.values()].some((job) => job.status === "RUNNING");
    if (running) {
      res
        .status(409)
        .json({
          success: false,
          message: "Another load test is already running",
        });
      return;
    }
    if (jobs.size >= 20) {
      const oldest = [...jobs.values()]
        .filter((job) => job.status !== "RUNNING")
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
      if (oldest) jobs.delete(oldest.id);
    }
    const job: Job = {
      id: randomUUID(),
      ...input,
      completed: 0,
      succeeded: 0,
      failed: 0,
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      latencies: [],
      statusCodes: {},
      errors: {},
      stopped: false,
    };
    jobs.set(job.id, job);
    void run(job, String(req.header("cookie") ?? ""));
    res
      .status(202)
      .json({ success: true, message: "Load test started", data: view(job) });
  } catch (error) {
    next(error);
  }
});
router.get("/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ success: false, message: "Load test not found" });
    return;
  }
  res.json({ success: true, message: "Load test loaded", data: view(job) });
});
router.post("/:id/stop", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ success: false, message: "Load test not found" });
    return;
  }
  job.stopped = true;
  res.json({ success: true, message: "Load test stopping", data: view(job) });
});
router.get("/", (_req, res) =>
  res.json({
    success: true,
    message: "Load tests loaded",
    data: [...jobs.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20)
      .map(view),
  }),
);
export const loadTestRouter = router;
