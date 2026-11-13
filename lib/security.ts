import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { rows, sql } from "./db";
import { origin } from "./config";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export function credential(purpose: string, id: string) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret || secret.length < 32)
    throw new ApiError(
      503,
      "CONFIGURATION",
      "Registration service is not configured.",
    );
  return createHmac("sha256", secret)
    .update(`${purpose}:${id}`)
    .digest("base64url");
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function passwordMatches(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function throttle(req: Request, scope: string, limit = 20) {
  const ip =
    process.env.TRUST_PROXY === "true"
      ? req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
      : "local";
  const key = hash(`${scope}:${ip}`);
  const result = await rows<{ count: number }>(
    sql`INSERT INTO rate_limits(key,count,expires_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE rate_limits.expires_at END RETURNING count`,
  );
  if (result[0].count > limit)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "Too many requests. Please try again in 15 minutes.",
    );
}
export function sameOrigin(req: Request) {
  if (req.headers.get("origin") !== origin())
    throw new ApiError(403, "ORIGIN", "Request origin is not allowed.");
}
export async function body(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "CONTENT_TYPE", "JSON required.");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "BODY", "Request body required.");
  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 24000) {
      await reader.cancel();
      throw new ApiError(413, "BODY", "Request too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new ApiError(400, "JSON", "Malformed JSON.");
  }
}
export type Admin = {
  id: string;
  email: string;
  role: "admin" | "reviewer" | "checkin";
};
export async function admin(
  roles: Admin["role"][] = ["admin", "reviewer", "checkin"],
) {
  const token = (await cookies()).get("holo_admin")?.value;
  const found = token
    ? await rows<Admin>(
        sql`SELECT u.id,u.email,u.role FROM admin_sessions s JOIN admin_users u ON u.id=s.admin_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND u.active=true`,
      )
    : [];
  if (!found.length)
    throw new ApiError(401, "AUTH", "Organizer login required.");
  if (!roles.includes(found[0].role))
    throw new ApiError(
      403,
      "ROLE",
      "This action requires a different organizer role.",
    );
  return found[0];
}
export async function setCookie(name: string, value: string, maxAge: number) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}
export const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe =
    /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
};
