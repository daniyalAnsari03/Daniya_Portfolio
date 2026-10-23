import "server-only";

import { createHmac } from "node:crypto";

/**
 * Best-effort client IP from the proxy headers. The raw value is only ever
 * used to derive the HMAC below; it is never stored or logged.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

/**
 * HMAC-SHA256 of the client IP. Fails closed when the secret is missing so a
 * deployment can never end up storing or comparing an unkeyed hash.
 */
export function hashIp(ip: string): string {
  const secret = process.env.CHAT_IP_HASH_SECRET?.trim();
  if (!secret) throw new Error("CHAT_IP_HASH_SECRET is not set");

  return createHmac("sha256", secret).update(ip).digest("hex");
}
