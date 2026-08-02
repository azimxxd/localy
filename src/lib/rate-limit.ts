import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

interface Bucket {
  count: number;
  resetAt: number;
}

const globalBuckets = globalThis as typeof globalThis & { __localyRateLimits?: Map<string, Bucket> };
const buckets = globalBuckets.__localyRateLimits ?? new Map<string, Bucket>();
globalBuckets.__localyRateLimits = buckets;

let limiterClient: SupabaseClient | null = null;

function getLimiterClient(): SupabaseClient | null {
  if (process.env.LOCALY_REPO !== 'supabase') return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  limiterClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return limiterClient;
}

export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const remote = getLimiterClient();
  if (remote) {
    const result = await remote.rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (result.error) throw new Error(`Rate limiter недоступен: ${result.error.message}`);
    return result.data === true;
  }
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  return true;
}

export async function requestRateLimitKey(scope: string): Promise<string> {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || store.get('x-real-ip') || 'local';
  return `${scope}:${ip}`;
}
