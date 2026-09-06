import { apiConfig } from '../config/api';
export class ApiError extends Error {constructor(message:string,public status:number,public fieldErrors:Record<string,string[]>={}){super(message);this.name='ApiError';}}
const pendingRequests = new Set<AbortController>();
export function cancelApiRequests() { for (const controller of pendingRequests) controller.abort(); pendingRequests.clear(); }
export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  let visitorId = localStorage.getItem("bracu-food-express:visitor-id");
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem("bracu-food-express:visitor-id", visitorId);
  }
  const controller = new AbortController();
  pendingRequests.add(controller);
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  try {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...options,
    signal,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Visitor-Id": visitorId,
      ...options.headers,
    },
  });
  const body = (await response
    .json()
    .catch(() => ({ message: "Request failed" }))) as {
    data: T;
    message?: string;
    errors?: {fieldErrors?:Record<string,string[]>};
  };
  if (!response.ok) {const fields=body.errors?.fieldErrors??{};const detail=Object.entries(fields).map(([field,messages])=>field+': '+messages.join(', ')).join('; ');throw new ApiError(detail||body.message||'Request failed',response.status,fields);}
  signal.throwIfAborted();
  return body.data;
  } finally { pendingRequests.delete(controller); }
}
