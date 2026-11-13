import { randomUUID, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db, rows, sql } from "./db";
import { ApiError, credential, hash, setCookie } from "./security";
import {
  registrationSchema,
  normalizeTeam,
  validateDomains,
} from "./validation";
import { domains, event } from "./config";
export type Member = {
  full_name: string;
  roll_number: string;
  email: string;
  phone: string;
  academic_year: number;
  branch: string;
  is_team_leader: boolean;
};
export type Team = {
  id: string;
  public_registration_id: string;
  team_name: string;
  status: string;
  created_at: string;
  ticket_id: string;
  ticket_status: string;
  checked_in_at: string | null;
  members: Member[];
};
export async function getTeam(publicId: string): Promise<Team | undefined> {
  const teams = await rows<Team>(
    sql`SELECT t.id,t.public_registration_id,t.team_name,t.status,t.created_at,k.id AS ticket_id,k.status AS ticket_status,c.checked_in_at FROM teams t JOIN tickets k ON k.team_id=t.id LEFT JOIN check_ins c ON c.ticket_id=k.id WHERE t.public_registration_id=${publicId}`,
  );
  if (!teams[0]) return;
  teams[0].members = await rows<Member>(
    sql`SELECT full_name,roll_number,email,phone,academic_year,branch,is_team_leader FROM participants WHERE team_id=${teams[0].id} ORDER BY position`,
  );
  return teams[0];
}
export async function authorizedTeam(publicId: string) {
  const token = (await cookies()).get(`holo_${publicId}`)?.value;
  const found = token
    ? await rows(
        sql`SELECT id FROM teams WHERE public_registration_id=${publicId} AND access_hash=${hash(token)}`,
      )
    : [];
  if (!found.length)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Registration not available in this browser. Use your recovery key.",
    );
  const team = await getTeam(publicId);
  if (!team) throw new ApiError(404, "NOT_FOUND", "Registration not found.");
  return team;
}
export async function createRegistration(input: unknown, key: string | null) {
  if (!key || !/^[a-zA-Z0-9_-]{32,100}$/.test(key))
    throw new ApiError(
      400,
      "IDEMPOTENCY",
      "A secure idempotency key is required.",
    );
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success)
    throw new ApiError(
      422,
      "VALIDATION",
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  const data = parsed.data;
  if (!validateDomains(data, domains()))
    throw new ApiError(
      422,
      "EMAIL_DOMAIN",
      `All members must use an approved university email: ${domains().join(", ")}.`,
    );
  const keyHash = hash(key),
    requestHash = hash(JSON.stringify(data)),
    access = credential("access", key);
  const existing = await rows<{
    public_registration_id: string;
    request_hash: string;
  }>(
    sql`SELECT public_registration_id,request_hash FROM teams WHERE idempotency_hash=${keyHash}`,
  );
  if (existing[0]) {
    if (existing[0].request_hash !== requestHash)
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This submission key belongs to different data. Recover the original registration before changing it.",
      );
    await setCookie(
      `holo_${existing[0].public_registration_id}`,
      access,
      60 * 60 * 24 * 30,
    );
    return { id: existing[0].public_registration_id, replayed: true };
  }
  if (
    process.env.REGISTRATION_OPEN !== "true" ||
    process.env.POLICY_APPROVED !== "true"
  )
    throw new ApiError(
      503,
      "REGISTRATION_CLOSED",
      "Registration is not open yet. Please return after the organizers announce access.",
    );
  const teamId = randomUUID(),
    ticketId = randomUUID(),
    publicId = `HL-${randomBytes(6).toString("hex").toUpperCase()}`;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO teams(id,public_registration_id,normalized_team_name,team_name,access_hash,idempotency_hash,request_hash) VALUES(${teamId},${publicId},${normalizeTeam(data.teamName)},${data.teamName},${hash(access)},${keyHash},${requestHash})`,
      );
      for (const [i, m] of data.members.entries())
        await tx.execute(
          sql`INSERT INTO participants(id,team_id,position,full_name,roll_number,email,phone,academic_year,branch,is_team_leader) VALUES(${randomUUID()},${teamId},${i},${m.fullName},${m.rollNumber},${m.email},${m.phone},${m.academicYear},${m.branch},${i === 0})`,
        );
      await tx.execute(
        sql`INSERT INTO registration_consents(id,team_id,terms_version,privacy_version,declarations) VALUES(${randomUUID()},${teamId},${event.termsVersion},${event.privacyVersion},${JSON.stringify(data.consents)}::jsonb)`,
      );
      await tx.execute(
        sql`INSERT INTO tickets(id,team_id,verification_token_hash) VALUES(${ticketId},${teamId},${hash(credential("ticket", ticketId))})`,
      );
      await tx.execute(
        sql`INSERT INTO registration_audit_events(id,team_id,action,actor_type) VALUES(${randomUUID()},${teamId},'registration_created','team')`,
      );
    });
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if ((e.code || e.cause?.code) === "23505") {
      const replay = await rows<{
        public_registration_id: string;
        request_hash: string;
      }>(
        sql`SELECT public_registration_id,request_hash FROM teams WHERE idempotency_hash=${keyHash}`,
      );
      if (replay[0]?.request_hash === requestHash) {
        await setCookie(
          `holo_${replay[0].public_registration_id}`,
          access,
          2592000,
        );
        return { id: replay[0].public_registration_id, replayed: true };
      }
      throw new ApiError(
        409,
        "DUPLICATE",
        "This team name or participant is already registered. Check your original registration or contact the organizers.",
      );
    }
    throw error;
  }
  await setCookie(`holo_${publicId}`, access, 2592000);
  return { id: publicId, replayed: false };
}
export async function verifyTicket(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return { status: "invalid" };
  const result = await rows<{
    status: string;
    ticket_status: string;
    public_registration_id: string;
    team_name: string;
    checked_in_at: string | null;
  }>(
    sql`SELECT t.status,k.status AS ticket_status,t.public_registration_id,t.team_name,c.checked_in_at FROM tickets k JOIN teams t ON t.id=k.team_id LEFT JOIN check_ins c ON c.ticket_id=k.id WHERE k.verification_token_hash=${hash(token)}`,
  );
  const r = result[0];
  if (!r) return { status: "invalid" };
  return {
    status:
      r.status === "revoked" || r.ticket_status === "revoked"
        ? "revoked"
        : r.checked_in_at
          ? "already_checked_in"
          : r.status === "pending_review"
            ? "pending_review"
            : "valid",
    registrationId: r.public_registration_id,
    teamName: r.team_name,
  };
}
