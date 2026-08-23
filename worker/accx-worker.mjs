/**
 * One-shot ACCX worker invocation. Schedule this process in a private runtime;
 * it never receives vault, Paradox, admin, or workload credentials.
 */
const baseUrl = (process.env.ACCX_CONTROL_PLANE_URL || "").replace(/\/$/, "");
const workerKey = process.env.ACCX_WORKER_KEY || "";
const workerId = process.env.ACCX_WORKER_ID || `accx-worker-${process.pid}`;
if (!/^https:\/\//.test(baseUrl) || !workerKey) throw new Error("ACCX_CONTROL_PLANE_URL (HTTPS) and ACCX_WORKER_KEY are required.");

const response = await fetch(`${baseUrl}/api/v1/internal/dispatch`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-accx-worker-key": workerKey },
  body: JSON.stringify({ workerId, limit: 1 }),
  signal: AbortSignal.timeout(55_000),
});
if (!response.ok) throw new Error(`ACCX worker dispatch failed with HTTP ${response.status}.`);
const result = await response.json();
console.log(JSON.stringify({ dispatched: result.dispatched, statuses: result.results?.map(job => job.status) ?? [] }));
