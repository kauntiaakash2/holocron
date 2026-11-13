import { beforeAll, describe, it, expect } from "vitest";
import { ticketSvg, ticketPng, ticketPdf } from "../lib/tickets";
import {
  passwordHash,
  passwordMatches,
  csvCell,
  credential,
  hash,
} from "../lib/security";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import jsQR from "jsqr";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import type { Team } from "../lib/registrations";
const team: Team = {
  id: "test",
  public_registration_id: "HL-FIXTURE-ONLY",
  team_name: "The Syntax Order",
  status: "pending_review",
  created_at: "2026-10-15",
  ticket_id: "fixture-ticket",
  ticket_status: "issued",
  checked_in_at: null,
  members: ["Asha Rao", "Mira Das", "Arun Sen"].map((name, i) => ({
    full_name: name,
    roll_number: `23000${i}`,
    email: `fixture${i}@kiit.ac.in`,
    phone: "9876543210",
    academic_year: i + 1,
    branch: "CSE",
    is_team_leader: i === 0,
  })),
};
beforeAll(() => {
  process.env.TOKEN_SECRET = "synthetic-test-secret-do-not-use-in-production";
  process.env.APP_ORIGIN = "https://example.test";
});
describe("ticket rendering and security primitives", () => {
  it("escapes SVG user input and excludes contact PII", async () => {
    const svg = await ticketSvg({ ...team, team_name: '<script> & "team"' });
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("22 December 2026");
    expect(svg).toContain('aria-label="DECEMBER"');
    expect(svg).toContain('aria-label="22"');
    for (const m of team.members) {
      expect(svg).toContain(m.full_name);
      expect(svg).not.toContain(m.email);
      expect(svg).not.toContain(m.phone);
    }
  });
  it("renders a high-resolution PNG whose QR decodes to the correct private-free URL", async () => {
    const png = await ticketPng(team);
    const metadata = await sharp(png).metadata();
    expect(metadata.width).toBe(3200);
    expect(metadata.height).toBe(1920);
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const qr = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(qr?.data).toBe(
      `https://example.test/verify/${credential("ticket", team.ticket_id)}`,
    );
    await mkdir("output/playwright", { recursive: true });
    await writeFile("output/playwright/ticket-fixture.png", png);
  }, 20000);
  it("produces a readable landscape A4 PDF", async () => {
    const bytes = await ticketPdf(team);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBe(842);
    await writeFile("output/playwright/ticket-fixture.pdf", bytes);
  }, 20000);
  it("renders persisted admission states with revocation taking precedence", async () => {
    for (const [changes, expected] of [
      [{}, "REGISTERED · REVIEW PENDING"],
      [{ status: "approved" }, "APPROVED · VALID"],
      [
        { status: "approved", checked_in_at: "2026-12-22" },
        "ALREADY CHECKED IN",
      ],
      [{ status: "revoked", checked_in_at: "2026-12-22" }, "REVOKED"],
      [{ status: "approved", ticket_status: "revoked" }, "REVOKED"],
    ] as const) {
      const svg = await ticketSvg({ ...team, ...changes });
      expect(svg).toContain(`aria-label="${expected}"`);
    }
  });
  it("fits maximum-length names without truncation or font requests", async () => {
    const long = {
      ...team,
      team_name: "W".repeat(48),
      members: team.members.map((member) => ({
        ...member,
        full_name: "W".repeat(70),
      })),
    };
    const svg = await ticketSvg(long);
    expect(svg).toContain(long.team_name);
    expect(svg).toContain(long.members[0].full_name);
    // Outlined, locally bundled fonts keep every export independent of font loading.
    expect(svg).not.toContain("@font-face");
    expect(svg).not.toMatch(/(?:href|src)="https?:/);
    const font = fontkit.create(await readFile("public/fonts/DejaVuSans.ttf"));
    const labels = [
      ...svg.matchAll(
        /<g aria-label="(W+)" fill="[^"]+"><title>W+<\/title><g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)/g,
      ),
    ];
    expect(labels.length).toBeGreaterThan(4);
    for (const [, value, x, , scale] of labels) {
      const width =
        font.layout(value).positions.reduce((sum, p) => sum + p.xAdvance, 0) *
        Number(scale);
      // Roster labels must stop before the QR area; team names have the
      // full manifest width above the event information.
      expect(Number(x) + width).toBeLessThanOrEqual(
        Number(x) === 592 ? 952 : 1108,
      );
    }
  });
  it("hashes passwords with salts and rejects wrong passwords", () => {
    const a = passwordHash("a long fixture password");
    const b = passwordHash("a long fixture password");
    expect(a).not.toBe(b);
    expect(passwordMatches("a long fixture password", a)).toBe(true);
    expect(passwordMatches("wrong", a)).toBe(false);
  });
  it("separates access and ticket token purposes", () => {
    expect(credential("access", "id")).not.toBe(credential("ticket", "id"));
    expect(hash(credential("ticket", "id"))).toHaveLength(64);
  });
  it("neutralizes spreadsheet formulas and quotes embedded quotation marks", () => {
    for (const value of [
      "=1+1",
      "+SUM(A1)",
      "-1",
      "@sum",
      "  =SUM(A1)",
      "\t=evil",
    ])
      expect(csvCell(value).startsWith("\"'")).toBe(true);
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
