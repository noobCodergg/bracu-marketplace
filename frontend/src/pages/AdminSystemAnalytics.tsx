import { useMutation,useQuery } from "@tanstack/react-query";
import {
Activity,
AlertTriangle,
Clock3,
Database,
Gauge,
RefreshCw,
Server,
ShieldAlert,
Users,
} from "lucide-react";
import { useState } from "react";
import {
Bar,
BarChart,
CartesianGrid,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";
import { Badge,Button,Empty,Loading } from "../components/ui";
import { loadTestService,systemAnalyticsService } from "../services";

const duration = (seconds: number) => {
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return days
    ? `${days}d ${hours}h`
    : hours
      ? `${hours}h ${minutes}m`
      : `${minutes}m`;
};
const time = (value: string) => new Date(value).toLocaleString();
const methodTone = (method: string) =>
  method === "GET"
    ? "green"
    : method === "DELETE"
      ? "red"
      : method === "PATCH"
        ? "amber"
        : "purple";

function Metric({
  label,
  value,
  detail,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  Icon: typeof Activity;
  tone: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span
          className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}
        >
          <Icon size={21} />
        </span>
      </div>
      <p className="mt-4 text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-stone-400">{detail}</p>
    </div>
  );
}

function LoadTestPanel() {
  const [path, setPath] = useState("/api/v1/products/best-selling"),
    [total, setTotal] = useState(100),
    [concurrency, setConcurrency] = useState(10),
    [jobId, setJobId] = useState<string | null>(null);
  const start = useMutation({meta:{successMessage:"Load test started."},
    mutationFn: () => loadTestService.start({ path, total, concurrency }),
    onSuccess: (job) => setJobId(job.id),
  });
  const job = useQuery({
    queryKey: ["load-test", jobId],
    queryFn: () => loadTestService.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) =>
      query.state.data?.status === "RUNNING" ? 1250 : false,
  });
  const stop = useMutation({meta:{successMessage:"Load test stopped."},
    mutationFn: () => loadTestService.stop(jobId!),
    onSuccess: () => job.refetch(),
  });
  const result = job.data;
  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b p-6">
        <h2 className="text-xl font-extrabold">API load test</h2>
        <p className="text-sm text-stone-500">
          Send real concurrent GET requests using virtual users. Maximum 20,000
          requests and 200 concurrent users.
        </p>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-[1fr,160px,160px,auto]">
        <label>
          <span className="label">API path</span>
          <input
            className="field font-mono text-sm"
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/api/v1/products"
          />
        </label>
        <label>
          <span className="label">Total requests</span>
          <input
            className="field"
            type="number"
            min={1}
            max={20000}
            value={total}
            onChange={(event) => setTotal(Number(event.target.value))}
          />
        </label>
        <label>
          <span className="label">Virtual users</span>
          <input
            className="field"
            type="number"
            min={1}
            max={200}
            value={concurrency}
            onChange={(event) => setConcurrency(Number(event.target.value))}
          />
        </label>
        <div className="flex items-end gap-2">
          <Button
            disabled={
              start.isPending ||
              result?.status === "RUNNING" ||
              !path.startsWith("/api/v1/") ||
              concurrency > total
            }
            onClick={() => start.mutate()}
          >
            {start.isPending ? "Starting..." : "Start test"}
          </Button>
          {result?.status === "RUNNING" && (
            <Button
              variant="danger"
              disabled={stop.isPending}
              onClick={() => stop.mutate()}
            >
              Stop
            </Button>
          )}
        </div>
      </div>
      {(start.isError || job.isError) && (
        <p className="mx-6 mb-5 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
          {(start.error ?? job.error)?.message}
        </p>
      )}
      {result && (
        <div className="border-t bg-stone-50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <b>
              {result.status} · {result.progress}%
            </b>
            <span className="text-sm text-stone-500">
              {result.completed.toLocaleString()} /{" "}
              {result.total.toLocaleString()}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${result.progress}%` }}
            />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Throughput"
              value={`${result.requestsPerSecond}/s`}
              detail={`${result.succeeded} successful · ${result.failed} failed`}
              Icon={Activity}
              tone="bg-blue-100 text-blue-700"
            />
            <Metric
              label="Average latency"
              value={`${result.latency.average} ms`}
              detail={`min ${result.latency.min} · max ${result.latency.max}`}
              Icon={Clock3}
              tone="bg-violet-100 text-violet-700"
            />
            <Metric
              label="P95 latency"
              value={`${result.latency.p95} ms`}
              detail={`P50 ${result.latency.p50} · P99 ${result.latency.p99}`}
              Icon={Gauge}
              tone="bg-amber-100 text-amber-700"
            />
            <Metric
              label="HTTP responses"
              value={
                Object.entries(result.statusCodes)
                  .map(([code, count]) => `${code}: ${count}`)
                  .join(" · ") || "—"
              }
              detail={
                Object.entries(result.errors)
                  .map(([name, count]) => `${name}: ${count}`)
                  .join(" · ") || "No transport errors"
              }
              Icon={Server}
              tone={
                result.failed
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}

export function AdminSystemAnalytics() {
  const [minutes, setMinutes] = useState(60),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-system-analytics", minutes, page],
    queryFn: () => systemAnalyticsService.get(minutes, page),
    refetchInterval: 15000,
  });
  const data = query.data;
  if (query.isError)
    return (
      <div>
        <h1 className="text-3xl font-extrabold">System analytics</h1>
        <div className="card mt-7 border-red-200 bg-red-50 p-8 text-center">
          <Server className="mx-auto text-red-600" size={44} />
          <h2 className="mt-4 text-2xl font-extrabold text-red-800">
            System analytics API is unavailable
          </h2>
          <p className="mt-2 text-sm text-red-700">
            The backend may be down, unreachable, or unable to connect to its
            database.
          </p>
          <Button className="mt-5" onClick={() => query.refetch()}>
            <RefreshCw size={16} />
            Retry health check
          </Button>
        </div>
      </div>
    );
  if (query.isLoading || !data) return <Loading />;
  const trafficChart = data.traffic.map((point) => ({
    ...point,
    label: new Date(point.time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold">System analytics</h1>
            <Badge tone={data.server.status === "UP" ? "green" : "red"}>
              {data.server.status}
            </Badge>
          </div>
          <p className="mt-1 text-stone-500">
            Live API traffic, abuse signals, server health, and active users.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="field w-auto"
            value={minutes}
            onChange={(event) => {
              setMinutes(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={15}>Last 15 minutes</option>
            <option value={60}>Last hour</option>
            <option value={360}>Last 6 hours</option>
            <option value={1440}>Last 24 hours</option>
          </select>
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            <RefreshCw
              size={16}
              className={query.isFetching ? "animate-spin" : ""}
            />
            Refresh
          </Button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Server health"
          value={data.server.status}
          detail={`Database ${data.server.database.toLowerCase()} · uptime ${duration(data.server.uptimeSeconds)}`}
          Icon={Server}
          tone="bg-emerald-100 text-emerald-700"
        />
        <Metric
          label="Active users"
          value={String(data.summary.activeUsers)}
          detail={`${data.summary.activeAuthenticatedUsers} authenticated · ${data.summary.activeGuests} guests · last 5 min`}
          Icon={Users}
          tone="bg-blue-100 text-blue-700"
        />
        <Metric
          label="Request rate"
          value={`${data.summary.requestsPerMinute}/min`}
          detail={`${data.summary.totalRequests.toLocaleString()} requests in selected range`}
          Icon={Activity}
          tone="bg-violet-100 text-violet-700"
        />
        <Metric
          label="Server error rate"
          value={`${data.summary.errorRate}%`}
          detail={`${data.summary.serverErrors} server errors · ${data.summary.clientErrors} rejected`}
          Icon={ShieldAlert}
          tone={
            data.summary.errorRate > 5
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
          }
        />
        <Metric
          label="Current API load"
          value={`${data.capacity.inFlight} / ${data.capacity.maxInFlight}`}
          detail={`${data.capacity.utilizationPercent}% executing · ${data.capacity.availableSlots} slots available`}
          Icon={Gauge}
          tone={data.capacity.utilizationPercent>=90?"bg-red-100 text-red-700":data.capacity.utilizationPercent>=70?"bg-amber-100 text-amber-700":"bg-emerald-100 text-emerald-700"}
        />
        <Metric
          label="Queue / load shed"
          value={`${data.capacity.queued} / ${data.capacity.maxQueue}`}
          detail={`${data.capacity.shedTotal} requests safely rejected since restart`}
          Icon={Activity}
          tone={data.capacity.queued||data.capacity.shedTotal?"bg-amber-100 text-amber-700":"bg-blue-100 text-blue-700"}
        />
      </div>
      {import.meta.env.DEV&&<LoadTestPanel />}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr,.6fr]">
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold">Request traffic</h2>
              <p className="text-sm text-stone-500">
                Continuous timeline of requests and server errors.
              </p>
            </div>
            <Badge tone="gray">Auto-refresh 15s</Badge>
          </div>
          <div className="mt-6 h-64">
            {trafficChart.some((point) => point.requests > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficChart} barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    minTickGap={28}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.time
                        ? time(payload[0].payload.time)
                        : ""
                    }
                  />
                  <Bar
                    name="Requests"
                    dataKey="requests"
                    fill="#20a45b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    name="Server errors"
                    dataKey="errors"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-stone-400">
                Traffic will appear after API requests arrive.
              </div>
            )}
          </div>
        </section>
        <section className="card p-6">
          <h2 className="text-xl font-extrabold">Runtime</h2>
          <div className="mt-5 space-y-4 text-sm">
            <p className="flex justify-between">
              <span className="flex gap-2 text-stone-500">
                <Database size={17} />
                Database
              </span>
              <b
                className={
                  data.server.database === "CONNECTED"
                    ? "text-emerald-700"
                    : "text-red-600"
                }
              >
                {data.server.database}
              </b>
            </p>
            <p className="flex justify-between">
              <span className="flex gap-2 text-stone-500">
                <Gauge size={17} />
                Average latency
              </span>
              <b>{data.summary.averageLatencyMs} ms</b>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">Maximum latency</span>
              <b>{data.summary.maxLatencyMs} ms</b>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">Memory</span>
              <b>{data.server.memoryUsedMb} MB</b>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">CPU / load</span>
              <b>
                {data.server.cpuCount} / {data.server.loadAverage}
              </b>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">Responses sent</span>
              <b>{data.summary.responseMb} MB</b>
            </p>
            <p className="flex justify-between">
              <span className="text-stone-500">Node</span>
              <b>{data.server.nodeVersion}</b>
            </p>
          </div>
        </section>
      </div>
      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
          <div>
            <h2 className="text-xl font-extrabold">API usage</h2>
            <p className="text-sm text-stone-500">
              Normalized endpoint volume, failures and response time.
            </p>
          </div>
          <span className="text-sm font-bold">
            {data.endpoints.total} endpoints
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                {[
                  "Method",
                  "Endpoint",
                  "Requests",
                  "4xx",
                  "5xx",
                  "Error rate",
                  "Avg latency",
                  "Max latency",
                  "Last request",
                ].map((header) => (
                  <th className="px-5 py-4" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.endpoints.items.map((endpoint) => (
                <tr
                  className="border-t"
                  key={`${endpoint.method}:${endpoint.path}`}
                >
                  <td className="px-5 py-3">
                    <Badge tone={methodTone(endpoint.method)}>
                      {endpoint.method}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs font-bold">
                    {endpoint.path}
                  </td>
                  <td className="px-5 py-3 font-extrabold">
                    {endpoint.requests}
                  </td>
                  <td className="px-5 py-3">{endpoint.clientErrors}</td>
                  <td className="px-5 py-3">{endpoint.serverErrors}</td>
                  <td className="px-5 py-3">{endpoint.errorRate}%</td>
                  <td className="px-5 py-3">{endpoint.averageLatencyMs} ms</td>
                  <td className="px-5 py-3">{endpoint.maxLatencyMs} ms</td>
                  <td className="px-5 py-3 text-xs text-stone-500">
                    {time(endpoint.lastSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.endpoints.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t p-4">
            <Button
              variant="secondary"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <b className="text-sm">
              Page {data.endpoints.page} of {data.endpoints.totalPages}
            </b>
            <Button
              variant="secondary"
              disabled={page >= data.endpoints.totalPages || query.isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </section>
      <section className="mt-6">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle
            className={
              data.suspiciousActors.length ? "text-red-600" : "text-emerald-600"
            }
          />
          <div>
            <h2 className="text-xl font-extrabold">Spam and abuse detection</h2>
            <p className="text-sm text-stone-500">
              Flags burst traffic, endpoint flooding, and repeated rejected
              requests.
            </p>
          </div>
        </div>
        {data.suspiciousActors.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.suspiciousActors.map((actor) => (
              <article
                className="card border-red-100 p-5"
                key={`${actor.actor}:${actor.topEndpoint}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold">{actor.actor}</h3>
                    <p className="text-xs text-stone-500">
                      {actor.email ?? "Anonymous visitor"} · last seen{" "}
                      {time(actor.lastSeen)}
                    </p>
                  </div>
                  <Badge tone={actor.risk === "MEDIUM" ? "amber" : "red"}>
                    {actor.risk}
                  </Badge>
                </div>
                <p className="mt-4 rounded-xl bg-red-50 p-3 font-mono text-xs text-red-800">
                  {actor.topEndpoint}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <b className="text-xl">{actor.requests1m}</b>
                    <p className="text-xs text-stone-500">requests / minute</p>
                  </div>
                  <div>
                    <b className="text-xl">{actor.requests15m}</b>
                    <p className="text-xs text-stone-500">
                      requests / 15 minutes
                    </p>
                  </div>
                </div>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-red-700">
                  {actor.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="No API spam detected"
            body="No visitor or account crossed the abuse thresholds in the last 15 minutes."
          />
        )}
      </section>
      <section className="card mt-6 overflow-hidden">
        <div className="border-b p-6">
          <h2 className="text-xl font-extrabold">
            Recent rejected and failed requests
          </h2>
          <p className="text-sm text-stone-500">
            Latest 4xx and 5xx responses for investigation.
          </p>
        </div>
        {data.recentErrors.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-stone-50">
                <tr>
                  {[
                    "Status",
                    "Request",
                    "Endpoint",
                    "Actor",
                    "Latency",
                    "Time",
                  ].map((header) => (
                    <th className="px-5 py-4" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentErrors.map((item) => (
                  <tr className="border-t" key={item.requestId}>
                    <td className="px-5 py-3">
                      <Badge tone={item.statusCode >= 500 ? "red" : "amber"}>
                        {item.statusCode}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs font-bold">
                      {item.method}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">{item.path}</td>
                    <td className="px-5 py-3">{item.actor}</td>
                    <td className="px-5 py-3">{item.durationMs} ms</td>
                    <td className="px-5 py-3 text-xs text-stone-500">
                      {time(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-sm font-bold text-emerald-700">
            No rejected or failed requests in this range.
          </div>
        )}
      </section>
      <p className="mt-4 flex items-center gap-2 text-xs text-stone-400">
        <Clock3 size={14} />
        Generated {time(data.generatedAt)}. Live bounded telemetry retains up to {data.retainedSamples.toLocaleString()} recent requests in memory;
        raw IP addresses and request bodies are not stored, and data resets after a server restart.
      </p>
    </>
  );
}
