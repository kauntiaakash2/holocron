"use client";
import { useEffect, useState } from "react";
export function Verification({ token }: { token: string }) {
  const [result, setResult] = useState<{
      status: string;
      teamName?: string;
      registrationId?: string;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/tickets/verify/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error.message);
        setResult(data);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <div className="verify-panel">
      <span className="eyebrow gold">HOL0CRON / CREDENTIAL VERIFICATION</span>
      <div className="verify-symbol" aria-hidden="true">
        ⬡
      </div>
      <h1>
        {result
          ? result.status.replaceAll("_", " ").toUpperCase()
          : "Verifying ticket…"}
      </h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <>
          <p>
            {result.teamName}
            <br />
            {result.registrationId}
          </p>
          <p>
            {result.status === "valid"
              ? "This team is approved for admission."
              : result.status === "pending_review"
                ? "Registration exists. Organizer eligibility review is still required."
                : result.status === "already_checked_in"
                  ? "This team has already been admitted."
                  : result.status === "revoked"
                    ? "This admission credential has been revoked."
                    : "This credential could not be verified."}
          </p>
          <div className="notice">
            Scanning does not check anyone in. Authorized organizers must
            explicitly confirm admission.
          </div>
        </>
      )}
    </div>
  );
}
