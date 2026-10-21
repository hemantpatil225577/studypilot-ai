import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "ERROR", public details?: string[]) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Central error handling: no stack traces, keys or internals leave the server. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message, code: e.code, details: e.details }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input", code: "INVALID_INPUT" }, { status: 400 });
      }
      log.error("unhandled_error", { name: e instanceof Error ? e.name : "unknown" });
      return NextResponse.json({ error: "Something went wrong. Please try again.", code: "INTERNAL" }, { status: 500 });
    }
  };
}

export async function requireUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "Your session has expired. Please sign in again.", "UNAUTHENTICATED");
  return { supabase, user: data.user };
}

export async function readJson(req: Request, maxBytes = 20_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "Request is too large", "TOO_LARGE");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON", "INVALID_JSON");
  }
}

// In-memory per-user limiter. Per server instance only (see README, known limitations).
const hits = new Map<string, number[]>();
export function rateLimit(userId: string) {
  const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 30);
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= limit) throw new ApiError(429, "AI request limit reached. Try again later.", "RATE_LIMITED");
  recent.push(now);
  hits.set(userId, recent);
}
