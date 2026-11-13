import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Team } from "./registrations";
import { credential } from "./security";
import { origin } from "./config";
export const TICKET_SIZE = { width: 1200, height: 720 } as const;

const xml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const revoked = (team: Team) =>
  team.status === "revoked" || team.ticket_status === "revoked";
const label = (team: Team) =>
  revoked(team)
    ? "REVOKED"
    : team.checked_in_at
      ? "ALREADY CHECKED IN"
      : team.status === "approved"
        ? "APPROVED · VALID"
        : "REGISTERED · REVIEW PENDING";
// Outline fonts once per rendered label so browser previews and native exports
// use identical glyphs without relying on system fonts or external font loading.
const loadTicketFonts = () =>
  Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/DejaVuSans.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/YatraOne-Latin.woff")),
  ]).then(([body, display]) => ({
    body: fontkit.create(body),
    display: fontkit.create(display),
  }));

let ticketFonts: ReturnType<typeof loadTicketFonts> | undefined;
let ticketLogo: Promise<string> | undefined;
const loadTicketLogo = () =>
  readFile(path.join(process.cwd(), "public/brand/holocron-logo.png")).then(
    (buffer) => `data:image/png;base64,${buffer.toString("base64")}`,
  );

export async function ticketSvg(team: Team) {
  const [fonts, logo] = await Promise.all([
    (ticketFonts ??= loadTicketFonts()),
    (ticketLogo ??= loadTicketLogo()),
  ]);
  const qr = await QRCode.toDataURL(
    `${origin()}/verify/${credential("ticket", team.ticket_id)}`,
    { width: 300, margin: 4, errorCorrectionLevel: "M" },
  );
  const width = (value: string, size: number) =>
    (fonts.body
      .layout(value)
      .positions.reduce((sum, p) => sum + p.xAdvance, 0) *
      size) /
    fonts.body.unitsPerEm;
  const lines = (value: string, size: number, limit: number) => {
    const result: string[] = [];
    let current = "";
    for (const character of value) {
      if (current && width(current + character, size) > limit) {
        const space = current.lastIndexOf(" ");
        if (space > 0) {
          result.push(current.slice(0, space));
          current = current.slice(space + 1) + character;
        } else {
          result.push(current);
          current = character;
        }
      } else current += character;
    }
    if (current) result.push(current);
    return result;
  };
  function text(
    value: string,
    x: number,
    y: number,
    size: number,
    color = "#f3f0e7",
    display = false,
    align: "start" | "center" = "start",
  ) {
    const font = display ? fonts.display : fonts.body;
    const run = font.layout(value);
    // Center the visible glyph outlines, rather than guessing from characters
    // or aligning unlike font side bearings to the same starting coordinate.
    const originX =
      align === "center"
        ? x - ((run.bbox.minX + run.bbox.maxX) * size) / (2 * font.unitsPerEm)
        : x;
    let advance = 0;
    const paths = run.glyphs
      .map((glyph, i) => {
        const p = run.positions[i];
        const shape = `<path transform="translate(${advance + p.xOffset} ${p.yOffset})" d="${glyph.path.toSVG()}"/>`;
        advance += p.xAdvance;
        return shape;
      })
      .join("");
    return `<g aria-label="${xml(value)}" fill="${color}"><title>${xml(value)}</title><g transform="translate(${originX} ${y}) scale(${size / font.unitsPerEm} ${-size / font.unitsPerEm})">${paths}</g></g>`;
  }
  let titleSize = 28;
  while (lines(team.team_name, titleSize, 548).length > 2 && titleSize > 16)
    titleSize--;
  const teamTitle = lines(team.team_name, titleSize, 548)
    .map((line, i) => text(line, 560, 204 + i * 32, titleSize))
    .join("");
  const roster = team.members
    .map((member, i) => {
      // Validated names fit in two lines at this size, including long unbroken names.
      let nameSize = 16;
      while (lines(member.full_name, nameSize, 360).length > 2 && nameSize > 10)
        nameSize--;
      const y = 455 + i * 47;
      return (
        `<rect x="560" y="${y - 14}" width="19" height="19" rx="2" fill="none" stroke="#55ddf3" stroke-opacity=".65"/>` +
        text(`${i + 1}`, 566, y, 10, "#b5e6ee") +
        lines(member.full_name, nameSize, 360)
          .map((line, j) => text(line, 592, y + j * 17, nameSize))
          .join("") +
        (member.is_team_leader
          ? text("TEAM LEADER", 592, y - 19, 8, "#b5bdcb")
          : "")
      );
    })
    .join("");
  const status = label(team);
  const statusColor = revoked(team)
    ? "#ef8582"
    : team.status === "approved"
      ? "#55ddf3"
      : "#e5bd65";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TICKET_SIZE.width}" height="${TICKET_SIZE.height}" viewBox="0 0 ${TICKET_SIZE.width} ${TICKET_SIZE.height}" role="img" aria-labelledby="ticket-title ticket-description">
  <title id="ticket-title">HOL0CRON — ${xml(team.team_name)}</title>
  <desc id="ticket-description">Team admission ticket. ${xml(team.public_registration_id)}. ${xml(status)}. 22 December 2026, Campus 25, Lecture Halls, KIIT University. ${team.members.map((m) => xml(m.full_name)).join(", ")}.</desc>
  <defs>
    <linearGradient id="panel" x2="1" y2="1"><stop stop-color="#373b45"/><stop offset=".5" stop-color="#252d39"/><stop offset="1" stop-color="#131c28"/></linearGradient>
    <linearGradient id="curl" x2=".6" y2="1"><stop stop-color="#fff1c3"/><stop offset=".32" stop-color="#dfbf73"/><stop offset=".6" stop-color="#93703a"/><stop offset="1" stop-color="#d2aa59"/></linearGradient>
    <linearGradient id="posterShade" x2=".2" y2="1"><stop offset=".45" stop-color="#05070d" stop-opacity="0"/><stop offset="1" stop-color="#05070d" stop-opacity=".9"/></linearGradient>
    <clipPath id="posterClip"><path d="M48 32H390L495 348Q542 573 421 686H48Z"/></clipPath>
    <filter id="paperShadow" x="-30%" y="-20%" width="180%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <linearGradient id="poster" x2=".7" y2="1"><stop stop-color="#17232d"/><stop offset=".6" stop-color="#080e17"/><stop offset="1" stop-color="#05070d"/></linearGradient>
    <radialGradient id="light"><stop stop-color="#55ddf3" stop-opacity=".16"/><stop offset="1" stop-color="#55ddf3" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="720" fill="#05070d"/>
  <ellipse cx="655" cy="370" rx="520" ry="330" fill="url(#light)" opacity=".35"/>
  <rect x="348" y="64" width="804" height="586" rx="7" fill="url(#panel)" stroke="#7c8593" stroke-opacity=".45"/>
  <path d="M366 65H1144" stroke="#c5ced8" stroke-opacity=".12"/>
  ${text("HOL0CRON", 560, 108, 12, "#c8cdd5")}
  ${text("TEAM ADMISSION", 758, 108, 12, "#bdeef5")}
  ${text("2026 EDITION", 1006, 108, 11, "#c8cdd5")}
  <path d="M560 132H1108" stroke="#64707f" stroke-opacity=".65"/>
  <path d="M758 132H864" stroke="#55ddf3" stroke-width="3"/>
  ${text("TEAM MANIFEST / 03 BUILDERS", 560, 169, 10, "#b5bdcb")}
  ${teamTitle}
  ${text(team.public_registration_id, 560, 268, 13, "#e5bd65")}
  ${text("EVENT DATE", 560, 304, 9, "#b5bdcb")}
  ${text("22", 558, 351, 43, "#e5bd65")}
  ${text("DECEMBER", 626, 328, 14)}
  ${text("2026", 626, 350, 14, "#b5bdcb")}
  ${text("LOCATION", 820, 304, 9, "#b5bdcb")}
  ${text("Campus 25 · Lecture Halls", 820, 329, 14)}
  ${text("KIIT University, Bhubaneswar", 820, 353, 13, "#b5bdcb")}
  <path d="M560 387H1108" stroke="#566271" stroke-opacity=".55"/>
  ${text("THREE MINDS. ONE MISSION.", 560, 413, 10, "#b5bdcb")}
  ${roster}
  <image x="992" y="432" width="116" height="116" xlink:href="${qr}"/>
  ${text("VERIFY TEAM PASS", 1050, 569, 9, "#b5bdcb", false, "center")}
  <circle cx="563" cy="595" r="3" fill="${statusColor}"/>
  ${text(status, 576, 599, 11, statusColor)}
  ${text("Bring university ID. Admission requires eligibility approval.", 560, 623, 9, "#b5bdcb")}
  <path d="M66 48H408L513 364Q560 589 439 702H66Z" fill="#000" opacity=".55" filter="url(#paperShadow)"/>
  <g clip-path="url(#posterClip)">
    <rect x="48" y="32" width="500" height="654" fill="url(#poster)"/>
    <ellipse cx="300" cy="340" rx="280" ry="310" fill="url(#light)"/>
    <path d="M370 32H400L130 686H48Z" fill="#e5bd65" opacity=".05"/>
    <rect x="48" y="32" width="500" height="654" fill="url(#posterShade)"/>
    <image id="holocron-brand-art" x="76" y="142" width="376" height="376" preserveAspectRatio="xMidYMid meet" xlink:href="${logo}"/>
    <circle cx="98" cy="88" r="25" fill="#05070d" fill-opacity=".7" stroke="#b3a06c" stroke-opacity=".7"/>
    ${text("03", 98, 94, 20, "#e5bd65", false, "center")}
    ${text("THE FORBIDDEN", 144, 82, 10, "#e5bd65")}
    ${text("ARCHIVE", 144, 100, 10, "#b5bdcb")}
    ${text("HOL0CRON", 264, 570, 58, "#f3f0e7", true, "center")}
    ${text("BUILD WHAT COMES NEXT.", 264, 610, 14, "#e5bd65", false, "center")}
    ${text("A product-building hackathon for", 264, 641, 11, "#c4cbd6", false, "center")}
    ${text("the competitive programming ecosystem.", 264, 660, 11, "#c4cbd6", false, "center")}
  </g>
  <path d="M48 32H390L495 348Q542 573 421 686H48Z" fill="none" stroke="#c7b184" stroke-opacity=".55"/>
  <path d="M982 686Q1042 686 1062 610H1166V686Z" fill="#000" opacity=".5" transform="translate(3 7)" filter="url(#paperShadow)"/>
  <path d="M982 686Q1042 686 1062 610H1166V686Z" fill="url(#curl)" stroke="#e5d29b" stroke-opacity=".55"/>
  <path d="M982 686Q1042 686 1062 610Q1057 659 982 686Z" fill="#fff4d2" fill-opacity=".6"/>
  ${text("03", 1120, 653, 31, "#19212a", true, "center")}
  ${text("BUILDERS", 1120, 673, 8, "#19212a", false, "center")}
  ${text("AlgoZenith KIIT Chapter × KodeWreck", 560, 662, 10)}
  ${text("School of Computer Engineering, KIIT University", 560, 680, 9, "#b5bdcb")}
  </svg>`;
}
export async function ticketPng(team: Team) {
  return sharp(Buffer.from(await ticketSvg(team)), { density: 192 })
    .png()
    .toBuffer();
}
export async function ticketPdf(team: Team) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(path.join(process.cwd(), "public/fonts/DejaVuSans.ttf")),
    { subset: true },
  );
  const image = await doc.embedPng(await ticketPng(team));
  const page = doc.addPage([842, 595]);
  page.drawImage(image, {
    x: 25,
    y: 100,
    width: 792,
    height: (792 * TICKET_SIZE.height) / TICKET_SIZE.width,
  });
  page.drawText("HOL0CRON / PRINT COMPANION", {
    x: 30,
    y: 76,
    size: 11,
    font,
    color: rgb(0.08, 0.1, 0.15),
  });
  page.drawText(`${team.public_registration_id} | ${label(team)}`, {
    x: 30,
    y: 55,
    size: 10,
    font,
  });
  page.drawText(
    "One ticket admits the three listed members after organizer eligibility approval.",
    { x: 30, y: 37, size: 10, font },
  );
  page.drawText(
    "Bring university identification. Scanning this ticket does not check your team in.",
    { x: 30, y: 20, size: 10, font },
  );
  doc.setTitle(`HOL0CRON ${team.public_registration_id}`);
  return Buffer.from(await doc.save());
}
