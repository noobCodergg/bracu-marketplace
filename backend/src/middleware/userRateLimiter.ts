import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const WINDOW_MS = 1000,
  DEFAULT_LIMIT = 20,
  AUTH_LIMIT = 5,
  ANALYTICS_LIMIT = 2,
  AUTH_GLOBAL_LIMIT = 40,
  IP_BURST_LIMIT = 200,
  MAX_KEYS = 10000;
type Window={startedAt:number;count:number};
const windows = new Map<string, Window>();
export const internalLoadTestSecret = randomUUID();

function normalizedPath(originalUrl: string) {
  return originalUrl
    .split("?")[0]!
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi, "/:id")
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:number");
}

function identity(req: Parameters<RequestHandler>[0],path:string) {
  if (req.header("X-Internal-Load-Test-Secret") === internalLoadTestSecret) {
    const virtual = String(req.header("X-Load-Test-User") ?? "").slice(0, 100);
    if (virtual) return `virtual:${virtual}`;
  }
  if(path.startsWith('/api/v1/auth/'))return `auth-ip:${req.ip||req.socket.remoteAddress||'unknown'}`;
  const token = req.cookies?.session as string | undefined;
  if (!token)
    {const visitor=String(req.header('X-Visitor-Id')??'').trim().slice(0,100);return visitor.length>=8?`anonymous:${req.ip||req.socket.remoteAddress||'unknown'}:${visitor}`:`anonymous:${req.ip||req.socket.remoteAddress||'unknown'}`}
  try {
    return `user:${(jwt.verify(token, env.JWT_SECRET) as { sub: string }).sub}`;
  } catch {
    return `anonymous:${req.ip || req.socket.remoteAddress || "unknown"}`;
  }
}

export const userRateLimiter: RequestHandler = (req, res, next) => {
  if (!req.originalUrl.startsWith("/api/v1")) {
    next();
    return;
  }
  const path=normalizedPath(req.originalUrl);
  const limit = path.startsWith('/api/v1/auth/') ? AUTH_LIMIT : path.startsWith('/api/v1/analytics/events/') ? ANALYTICS_LIMIT : DEFAULT_LIMIT;
  const actor = identity(req,path),ip=req.ip||req.socket.remoteAddress||'unknown';
  const now = Date.now(),
    key = `${actor}:${req.method}:${path}`;
  if(path.startsWith('/api/v1/auth/')){
    const globalKey=`auth-global:${req.method}:${path}`,globalWindow=windows.get(globalKey);
    if(globalWindow&&now-globalWindow.startedAt<WINDOW_MS&&globalWindow.count>=AUTH_GLOBAL_LIMIT){res.setHeader('Retry-After','1');res.status(429).json({success:false,message:'Authentication service is busy. Try again shortly.'});return}
    if(!globalWindow||now-globalWindow.startedAt>=WINDOW_MS)windows.set(globalKey,{startedAt:now,count:1});else globalWindow.count+=1;
  }
  const ipKey=`ip-burst:${ip}`,ipWindow=windows.get(ipKey);
  if(ipWindow&&now-ipWindow.startedAt<WINDOW_MS&&ipWindow.count>=IP_BURST_LIMIT){res.setHeader('Retry-After','1');res.status(429).json({success:false,message:'Too many requests from this network. Try again shortly.'});return}
  if(!ipWindow||now-ipWindow.startedAt>=WINDOW_MS)windows.set(ipKey,{startedAt:now,count:1});else ipWindow.count+=1;
  let window=windows.get(key);
  if(!window||now-window.startedAt>=WINDOW_MS){window={startedAt:now,count:0};windows.set(key,window)}
  if(windows.size>MAX_KEYS){const oldest=windows.keys().next().value;if(oldest)windows.delete(oldest)}
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader(
    "RateLimit-Remaining",
    String(Math.max(0, limit - window.count)),
  );
  res.setHeader(
    "RateLimit-Reset",
    String(Math.ceil((window.startedAt + WINDOW_MS) / 1000)),
  );
  if (window.count >= limit) {
    const retrySeconds = Math.max(
      1,
      Math.ceil((window.startedAt + WINDOW_MS - now) / 1000),
    );
    res.setHeader("Retry-After", String(retrySeconds));
    res
      .status(429)
      .json({
        success: false,
        message: `Too many requests to this endpoint. Try again in ${retrySeconds} second${retrySeconds === 1 ? "" : "s"}.`,
      });
    return;
  }
  window.count+=1;
  res.setHeader("RateLimit-Remaining", String(limit - window.count));
  next();
};

const cleanup = setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, window] of windows)
    if (window.startedAt < cutoff) windows.delete(key);
}, 30000);
cleanup.unref();
