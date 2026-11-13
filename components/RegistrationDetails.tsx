"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Team } from "@/lib/registrations";
export function RegistrationDetails({ id }: { id: string }) {
  const [team, setTeam] = useState<Team | null>(null),
    [error, setError] = useState(""),
    [download, setDownload] = useState(""),
    [recovery, setRecovery] = useState("");
  useEffect(() => {
    fetch(`/api/registrations/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error.message);
        setTeam(data);
        try {
          setRecovery(sessionStorage.getItem(`holo_recovery_${id}`) || "");
        } catch {
          /* Browser storage may be disabled; cookie retrieval still works. */
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);
  async function save(format: string) {
    setDownload(format);
    setError("");
    try {
      const res = await fetch(
        `/api/registrations/${id}/ticket?format=${format}`,
      );
      if (!res.ok) throw new Error("Ticket export unavailable. Please retry.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `HOL0CRON-${id}.${format}`;
      a.hidden = true;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownload("");
    }
  }
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error} <Link href="/register">Recover registration ↗</Link>
        </div>
      )}
      {!team && !error && (
        <p role="status">Retrieving your persisted registration…</p>
      )}
      {team && (
        <>
          <div className="page-intro success-head">
            <p className="eyebrow gold">
              TRANSMISSION CONFIRMED / {team.public_registration_id}
            </p>
            <h1>
              {team.status === "revoked"
                ? "Registration revoked."
                : "Archive access granted."}
            </h1>
            <p>
              {team.status === "revoked"
                ? "This ticket is no longer eligible for admission."
                : "Your team registration is saved. Your collectible access pass is ready."}
            </p>
            <span className="status-label">
              {team.status.replace("_", " ").toUpperCase()}
              {team.checked_in_at ? " / CHECKED IN" : ""}
            </span>
          </div>
          {team.status === "pending_review" && (
            <p className="notice">
              Registration confirmed. Admission requires organizer verification
              of all three members’ undergraduate enrollment. Bring university
              identification.
            </p>
          )}
          {/* Authenticated image URL; no credentials or PII in its query string. */}
          <img
            className="ticket-preview"
            src={`/api/registrations/${id}/ticket?format=svg`}
            width="1200"
            height="720"
            alt={`HOL0CRON admission ticket for ${team.team_name}. Registration ${id}. Roster and event details are listed below.`}
          />
          <div className="download-actions">
            <button
              className="button"
              disabled={!!download}
              onClick={() => save("png")}
            >
              {download === "png" ? "GENERATING PNG…" : "DOWNLOAD PNG"}{" "}
              <span>↓</span>
            </button>
            <button
              className="button secondary"
              disabled={!!download}
              onClick={() => save("pdf")}
            >
              {download === "pdf" ? "GENERATING PDF…" : "DOWNLOAD PRINT PDF"}{" "}
              <span>↓</span>
            </button>
          </div>
          <p role="status" className="eyebrow">
            {download ? "Preparing your high-resolution admission ticket." : ""}
          </p>
          {recovery && (
            <details className="recovery">
              <summary>Save your private recovery key</summary>
              <p className="notice">
                Store this key privately to retrieve the registration in another
                browser. Anyone with it can access your team’s personal
                information.
                <br />
                <code>{recovery}</code>
              </p>
              <button
                className="text-button"
                onClick={() => {
                  const blob = new Blob(
                    [
                      `HOL0CRON ${id}\nPrivate recovery key: ${recovery}\nRecover at ${location.origin}/register\n`,
                    ],
                    { type: "text/plain" },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${id}-private-recovery.txt`;
                  a.hidden = true;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download recovery key ↓
              </button>
            </details>
          )}
          <section id="registration-details">
            <h2>{team.team_name}</h2>
            <p>22 December 2026 · Campus 25, Lecture Halls, KIIT University</p>
            <div className="details-grid">
              {team.members.map((m) => (
                <article className="review-card" key={m.roll_number}>
                  <p className="eyebrow gold">
                    {m.is_team_leader ? "TEAM LEADER" : "TEAM MEMBER"}
                  </p>
                  <h3>{m.full_name}</h3>
                  <p>
                    {m.roll_number} · Year {m.academic_year}
                  </p>
                  <p>{m.branch}</p>
                  <p>
                    {m.email}
                    <br />
                    {m.phone}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
