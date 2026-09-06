import type {
User
} from "../types";
import { apiRequest } from './http';

export const adminService = {
  applications: () => apiRequest<import("../types").SellerApplication[]>("/seller-applications"),
  decide: (id: string, status: "APPROVED" | "REJECTED") =>
    apiRequest<{ application: import("../types").SellerApplication }>(
      `/seller-applications/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ).then((result) => result.application),
  reports:()=>apiRequest<import("../types").Report[]>("/reports"),
  updateReport:(id:string,input:{action:"UNDER_REVIEW"|"RESOLVE"|"DISMISS"|"WARN"|"SUSPEND"|"BAN";note?:string;durationDays?:number|null})=>apiRequest<import("../types").Report>(`/reports/${id}`,{method:"PATCH",body:JSON.stringify(input)}),
};

export const adminUserService = {
  list: () => apiRequest<User[]>("/admin/users"),
  setStatus: (
    id: string,
    input: {
      status: "ACTIVE" | "SUSPENDED" | "BANNED";
      reason?: string;
      durationDays?: number | null;
    },
  ) =>
    apiRequest<User>(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

export interface SystemAnalyticsData {
  generatedAt: string;
  rangeMinutes: number;
  telemetryMode: "LIVE_MEMORY";
  retainedSamples: number;
  server: {
    status: "UP" | "DEGRADED";
    database: "CONNECTED" | "UNAVAILABLE";
    startedAt: string;
    uptimeSeconds: number;
    nodeVersion: string;
    cpuCount: number;
    loadAverage: number;
    memoryUsedMb: number;
    memoryUsagePercent: number;
    databaseLatencyMs: number;
  };
  capacity:{inFlight:number;queued:number;maxInFlight:number;maxQueue:number;shedTotal:number;queueTimeoutMs:number;utilizationPercent:number;availableSlots:number};
  summary: {
    totalRequests: number;
    requestsPerMinute: number;
    serverErrors: number;
    clientErrors: number;
    errorRate: number;
    averageLatencyMs: number;
    maxLatencyMs: number;
    responseMb: number;
    activeUsers: number;
    activeAuthenticatedUsers: number;
    activeGuests: number;
  };
  endpoints: {
    items: {
      method: string;
      path: string;
      requests: number;
      serverErrors: number;
      clientErrors: number;
      errorRate: number;
      averageLatencyMs: number;
      maxLatencyMs: number;
      lastSeen: string;
    }[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  traffic: {
    time: string;
    requests: number;
    errors: number;
    averageLatencyMs: number;
  }[];
  suspiciousActors: {
    actor: string;
    email: string | null;
    userId: string | null;
    risk: "MEDIUM" | "HIGH" | "CRITICAL";
    requests1m: number;
    requests15m: number;
    topEndpoint: string;
    lastSeen: string;
    reasons: string[];
  }[];
  recentErrors: {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    actor: string;
    createdAt: string;
  }[];
}

export const systemAnalyticsService = {
  get: (minutes: number, page = 1) =>
    apiRequest<SystemAnalyticsData>(
      `/admin/system-analytics?minutes=${minutes}&page=${page}&limit=15`,
    ),
};

export interface LoadTestResult{id:string;path:string;total:number;concurrency:number;completed:number;succeeded:number;failed:number;status:"RUNNING"|"COMPLETED"|"STOPPED";startedAt:string;finishedAt?:string;progress:number;requestsPerSecond:number;latency:{average:number;min:number;max:number;p50:number;p95:number;p99:number};statusCodes:Record<string,number>;errors:Record<string,number>}

export const loadTestService={start:(input:{path:string;total:number;concurrency:number})=>apiRequest<LoadTestResult>("/admin/load-tests",{method:"POST",body:JSON.stringify(input)}),get:(id:string)=>apiRequest<LoadTestResult>(`/admin/load-tests/${id}`),list:()=>apiRequest<LoadTestResult[]>("/admin/load-tests"),stop:(id:string)=>apiRequest<LoadTestResult>(`/admin/load-tests/${id}/stop`,{method:"POST"})};

export const reactivationService = {
  mine:()=>apiRequest<import("../types").ReactivationRequest|null>("/reactivation-requests/mine"),
  request: (_user: User, reason: string) =>
    apiRequest<import("../types").ReactivationRequest>(
      "/reactivation-requests",
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  list: () =>
    apiRequest<import("../types").ReactivationRequest[]>(
      "/reactivation-requests",
    ),
  decide: (id: string, status: "APPROVED" | "REJECTED") =>
    apiRequest<import("../types").ReactivationRequest>(
      `/reactivation-requests/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
};
