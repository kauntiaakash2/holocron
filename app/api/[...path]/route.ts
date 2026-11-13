import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { db, rows, sql } from "@/lib/db";
import {
  admin,
  ApiError,
  body,
  credential,
  csvCell,
  hash,
  passwordMatches,
  randomToken,
  sameOrigin,
  setCookie,
  throttle,
} from "@/lib/security";
import {
  authorizedTeam,
  createRegistration,
  getTeam,
  verifyTicket,
} from "@/lib/registrations";
import { ticketPdf, ticketPng, ticketSvg } from "@/lib/tickets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: Request, ctx: Context) {
  try {
    const parts = (await ctx.params).path,
      p = parts.join("/"),
      url = new URL(req.url),
      method = req.method;
    if (method === "POST") sameOrigin(req);
    if (p === "registrations" && method === "POST") {
      await throttle(req, "registration", 12);
      return json(
        await createRegistration(
          await body(req),
          req.headers.get("idempotency-key"),
        ),
        201,
      );
    }
    if (p === "registrations/recover" && method === "POST") {
      await throttle(req, "recover", 10);
      const data = z
        .object({ key: z.string().regex(/^[\w-]{32,100}$/) })
        .parse(await body(req));
      const found = await rows<{ public_registration_id: string }>(
        sql`SELECT public_registration_id FROM teams WHERE idempotency_hash=${hash(data.key)}`,
      );
      if (!found[0])
        throw new ApiError(
          404,
          "NOT_FOUND",
          "No registration found for this recovery key.",
        );
      await setCookie(
        `holo_${found[0].public_registration_id}`,
        credential("access", data.key),
        2592000,
      );
      return json({ id: found[0].public_registration_id });
    }
    if (parts[0] === "registrations" && parts[1] && method === "GET") {
      const team = await authorizedTeam(parts[1]);
      if (parts.length === 2) return json(team);
      if (parts[2] === "ticket" && parts.length === 3) {
        await throttle(req, "ticket-export", 40);
        const format = url.searchParams.get("format") || "svg";
        if (!["png", "pdf", "svg"].includes(format))
          throw new ApiError(400, "FORMAT", "Choose PNG or PDF.");
        const data =
          format === "pdf"
            ? await ticketPdf(team)
            : format === "png"
              ? await ticketPng(team)
              : await ticketSvg(team);
        return new Response(
          typeof data === "string" ? data : new Uint8Array(data),
          {
            headers: {
              "Content-Type":
                format === "pdf"
                  ? "application/pdf"
                  : format === "png"
                    ? "image/png"
                    : "image/svg+xml",
              "Content-Disposition": `${format === "svg" ? "inline" : "attachment"}; filename="HOL0CRON-${team.public_registration_id}.${format}"`,
              "Cache-Control": "private, no-store",
            },
          },
        );
      }
    }
    if (
      parts[0] === "tickets" &&
      parts[1] === "verify" &&
      parts[2] &&
      method === "GET"
    ) {
      await throttle(req, "verify", 100);
      return json(await verifyTicket(parts[2]));
    }
    if (p === "admin/login" && method === "POST") {
      await throttle(req, "login", 8);
      const data = z
        .object({
          email: z.string().email().max(120),
          password: z.string().min(1).max(200),
        })
        .parse(await body(req));
      const users = await rows<{ id: string; password_hash: string }>(
        sql`SELECT id,password_hash FROM admin_users WHERE email=${data.email.toLowerCase().trim()} AND active=true`,
      );
      const user = users[0];
      const matched = passwordMatches(
        data.password,
        user?.password_hash ||
          "00000000000000000000000000000000:" + "0".repeat(128),
      );
      if (!user || !matched)
        throw new ApiError(
          401,
          "CREDENTIALS",
          "Email or password is incorrect.",
        );
      const token = randomToken();
      await db.execute(
        sql`INSERT INTO admin_sessions(token_hash,admin_id,expires_at) VALUES(${hash(token)},${user.id},now()+interval '8 hours')`,
      );
      await setCookie("holo_admin", token, 28800);
      return json({ ok: true });
    }
    if (p === "admin/logout" && method === "POST") {
      const token = (await cookies()).get("holo_admin")?.value;
      if (token)
        await db.execute(
          sql`DELETE FROM admin_sessions WHERE token_hash=${hash(token)}`,
        );
      await setCookie("holo_admin", "", 0);
      return json({ ok: true });
    }
    if (p === "admin/me" && method === "GET") return json(await admin());
    if (p === "admin/registrations" && method === "GET") {
      const actor = await admin(["admin", "reviewer"]);
      const search = (url.searchParams.get("search") || "").slice(0, 100),
        status = url.searchParams.get("status") || "";
      const found = await rows(
        sql`SELECT t.public_registration_id,t.team_name,t.status,t.created_at,c.checked_in_at FROM teams t JOIN tickets k ON k.team_id=t.id LEFT JOIN check_ins c ON c.ticket_id=k.id WHERE (${search}='' OR t.team_name ILIKE ${"%" + search + "%"} OR t.public_registration_id ILIKE ${"%" + search + "%"}) AND (${status}='' OR t.status=${status}) ORDER BY t.created_at DESC LIMIT 200`,
      );
      if (url.searchParams.get("format") === "csv") {
        if (actor.role !== "admin")
          throw new ApiError(
            403,
            "ROLE",
            "Only administrators may export data.",
          );
        await db.execute(
          sql`INSERT INTO registration_audit_events(id,action,actor_type,actor_id) VALUES(${randomUUID()},'registration_export','organizer',${actor.id})`,
        );
        const csv = [
          "Registration ID,Team,Status,Registered,Checked in",
          ...found.map((row) => Object.values(row).map(csvCell).join(",")),
        ].join("\r\n");
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="hol0cron-registrations.csv"',
            "Cache-Control": "no-store",
          },
        });
      }
      return json(found);
    }
    if (parts[0] === "admin" && parts[1] === "registrations" && parts[2]) {
      const actor = await admin(["admin", "reviewer"]);
      const team = await getTeam(parts[2]);
      if (!team) throw new ApiError(404, "NOT_FOUND", "Team not found.");
      if (method === "GET") {
        await db.execute(
          sql`INSERT INTO registration_audit_events(id,team_id,action,actor_type,actor_id) VALUES(${randomUUID()},${team.id},'participant_records_viewed','organizer',${actor.id})`,
        );
        return json(team);
      }
      if (method === "POST") {
        const { action } = z
          .object({ action: z.enum(["approve", "flag", "revoke"]) })
          .parse(await body(req));
        if (action === "revoke" && actor.role !== "admin")
          throw new ApiError(
            403,
            "ROLE",
            "Administrator required for revocation.",
          );
        await db.transaction(async (tx) => {
          const locked = (
            await tx.execute(
              sql`SELECT status FROM teams WHERE id=${team.id} FOR UPDATE`,
            )
          ).rows[0];
          if (locked.status === "revoked")
            throw new ApiError(
              409,
              "REVOKED",
              "A revoked registration cannot be reactivated.",
            );
          const status =
            action === "approve"
              ? "approved"
              : action === "flag"
                ? "pending_review"
                : "revoked";
          await tx.execute(
            sql`UPDATE teams SET status=${status},updated_at=now() WHERE id=${team.id}`,
          );
          if (action === "revoke") {
            await tx.execute(
              sql`UPDATE tickets SET status='revoked',revoked_at=now() WHERE team_id=${team.id}`,
            );
            await tx.execute(
              sql`UPDATE participants SET active=false WHERE team_id=${team.id}`,
            );
          }
          await tx.execute(
            sql`INSERT INTO registration_audit_events(id,team_id,action,actor_type,actor_id) VALUES(${randomUUID()},${team.id},${action},'organizer',${actor.id})`,
          );
        });
        return json({ ok: true });
      }
    }
    if (p === "admin/tickets/check-in" && method === "POST") {
      const actor = await admin(["admin", "checkin"]);
      const { token } = z
        .object({ token: z.string().regex(/^[\w-]{43}$/) })
        .parse(await body(req));
      await db.transaction(async (tx) => {
        const found = (
          await tx.execute(
            sql`SELECT t.id AS team_id,t.status,k.id AS ticket_id,k.status AS ticket_status FROM tickets k JOIN teams t ON t.id=k.team_id WHERE k.verification_token_hash=${hash(token)} FOR UPDATE OF t,k`,
          )
        ).rows[0];
        if (!found) throw new ApiError(404, "INVALID", "Invalid ticket.");
        if (found.status !== "approved" || found.ticket_status !== "issued")
          throw new ApiError(
            409,
            "NOT_APPROVED",
            "This ticket is not approved for admission.",
          );
        const inserted = await tx.execute(
          sql`INSERT INTO check_ins(id,ticket_id,checked_in_by) VALUES(${randomUUID()},${found.ticket_id},${actor.id}) ON CONFLICT(ticket_id) DO NOTHING RETURNING id`,
        );
        if (!inserted.rows.length)
          throw new ApiError(
            409,
            "ALREADY_CHECKED_IN",
            "This team is already checked in.",
          );
        await tx.execute(
          sql`INSERT INTO registration_audit_events(id,team_id,action,actor_type,actor_id) VALUES(${randomUUID()},${found.team_id},'checked_in','organizer',${actor.id})`,
        );
      });
      return json({ ok: true });
    }
    throw new ApiError(404, "NOT_FOUND", "Endpoint not found.");
  } catch (e) {
    if (e instanceof ApiError)
      return json({ error: { code: e.code, message: e.message } }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error: { code: "VALIDATION", message: "Check the supplied fields." },
        },
        422,
      );
    console.error("API failure", {
      type: e instanceof Error ? e.name : "Unknown",
    });
    return json(
      {
        error: {
          code: "UNAVAILABLE",
          message:
            "The service could not complete this request. Retry with the same submission key.",
        },
      },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
