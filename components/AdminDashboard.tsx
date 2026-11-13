"use client";
import { useEffect, useState } from "react";
import type { Admin } from "@/lib/security";
import type { Team } from "@/lib/registrations";
type Summary = {
  public_registration_id: string;
  team_name: string;
  status: string;
  created_at: string;
  checked_in_at: string | null;
};
async function api(path: string, body?: unknown) {
  const response = await fetch(
    `/api/${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error.message);
  return data;
}
export function AdminDashboard() {
  const [user, setUser] = useState<Admin | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [list, setList] = useState<Summary[]>([]),
    [detail, setDetail] = useState<Team | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [token, setToken] = useState(""),
    [verification, setVerification] = useState<{
      status: string;
      teamName?: string;
      registrationId?: string;
    } | null>(null),
    [confirm, setConfirm] = useState("");
  useEffect(() => {
    api("admin/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  async function load() {
    setError("");
    try {
      setList(
        await api(
          `admin/registrations?search=${encodeURIComponent(search)}&status=${status}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (user && user.role !== "checkin") void load();
  }, [user]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tokenValue = () => {
    try {
      return new URL(token).pathname.split("/").pop() || "";
    } catch {
      return token.trim();
    }
  };
  if (!ready) return <p role="status">Checking organizer session…</p>;
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow gold">RESTRICTED / ORGANIZER OPERATIONS</p>
        <h1>Archive control.</h1>
        <p>
          {user
            ? `${user.email} · ${user.role}`
            : "Sign in with your organizer account."}
        </p>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!user ? (
        <form
          className="form-panel"
          style={{ maxWidth: 480 }}
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void action(async () => {
              await api("admin/login", {
                email: data.get("email"),
                password: data.get("password"),
              });
              setUser(await api("admin/me"));
            });
          }}
        >
          <label className="field">
            Organizer email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button" disabled={busy}>
            SIGN IN ↗
          </button>
        </form>
      ) : (
        <>
          <button
            className="text-button"
            onClick={() =>
              action(async () => {
                await api("admin/logout", {});
                setUser(null);
                setDetail(null);
                setList([]);
              })
            }
          >
            Sign out
          </button>
          {user.role !== "checkin" && (
            <>
              <form
                className="admin-toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  void load();
                }}
              >
                <input
                  className="control"
                  aria-label="Search team or registration ID"
                  placeholder="Search team or registration ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="control"
                  aria-label="Registration status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="pending_review">Review pending</option>
                  <option value="approved">Approved</option>
                  <option value="revoked">Revoked</option>
                </select>
                <button className="button secondary">SEARCH</button>
                {user.role === "admin" && (
                  <a
                    className="text-button"
                    href={`/api/admin/registrations?format=csv&search=${encodeURIComponent(search)}&status=${status}`}
                  >
                    Export this view (CSV) ↓
                  </a>
                )}
              </form>
              <p className="eyebrow">
                LATEST 200 MATCHING REGISTRATIONS · EXPORT CONTAINS THIS VIEW
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>REGISTRATION</th>
                      <th>TEAM</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((t) => (
                      <tr key={t.public_registration_id}>
                        <td>{t.public_registration_id}</td>
                        <td>{t.team_name}</td>
                        <td>
                          {t.status.replace("_", " ")}
                          {t.checked_in_at ? " / checked in" : ""}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              action(async () => {
                                setDetail(
                                  await api(
                                    `admin/registrations/${t.public_registration_id}`,
                                  ),
                                );
                                setConfirm("");
                              })
                            }
                          >
                            Review →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!list.length && (
                  <p className="notice">No matching registrations.</p>
                )}
              </div>
              {detail && (
                <section className="admin-detail">
                  <div className="review-head">
                    <h2>{detail.team_name}</h2>
                    <button
                      className="text-button"
                      onClick={() => setDetail(null)}
                    >
                      Close ×
                    </button>
                  </div>
                  <p>
                    {detail.public_registration_id} · {detail.status}
                  </p>
                  <div className="details-grid">
                    {detail.members.map((m) => (
                      <div key={m.roll_number} className="review-card">
                        <h3>{m.full_name}</h3>
                        <p>
                          {m.roll_number} · Year {m.academic_year}
                          <br />
                          {m.branch}
                          <br />
                          {m.email}
                          <br />
                          {m.phone}
                        </p>
                      </div>
                    ))}
                  </div>
                  {detail.status !== "revoked" && (
                    <>
                      <p className="notice">
                        Before approving, verify current undergraduate
                        enrollment and year for all three participants against
                        university records or identification. An email address
                        is insufficient evidence.
                      </p>
                      <div className="download-actions">
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() => setConfirm("approve")}
                        >
                          APPROVE ELIGIBILITY
                        </button>
                        <button
                          disabled={busy}
                          className="button secondary"
                          onClick={() => setConfirm("flag")}
                        >
                          FLAG FOR REVIEW
                        </button>
                        {user.role === "admin" && (
                          <button
                            disabled={busy}
                            className="button danger"
                            onClick={() => setConfirm("revoke")}
                          >
                            REVOKE REGISTRATION
                          </button>
                        )}
                      </div>
                      {confirm && (
                        <div className="notice">
                          <p>
                            Confirm {confirm} for {detail.team_name}?{" "}
                            {confirm === "revoke"
                              ? "This invalidates the ticket and releases participant uniqueness for re-registration."
                              : "This updates admission eligibility."}
                          </p>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                await api(
                                  `admin/registrations/${detail.public_registration_id}`,
                                  { action: confirm },
                                );
                                setDetail(
                                  await api(
                                    `admin/registrations/${detail.public_registration_id}`,
                                  ),
                                );
                                setConfirm("");
                                await load();
                                setMessage("Registration updated.");
                              })
                            }
                          >
                            CONFIRM {confirm.toUpperCase()}
                          </button>{" "}
                          <button
                            className="text-button"
                            onClick={() => setConfirm("")}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
            </>
          )}
          {user.role !== "reviewer" && (
            <section className="admin-detail">
              <h2>Verify & check in</h2>
              <p>
                Paste the QR verification URL or token. A USB QR scanner can
                fill this field.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    setVerification(
                      await api(
                        `tickets/verify/${encodeURIComponent(tokenValue())}`,
                      ),
                    );
                  });
                }}
              >
                <label className="field">
                  Verification URL or token
                  <input
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      setVerification(null);
                    }}
                    autoComplete="off"
                    required
                  />
                </label>
                <button className="button secondary" disabled={busy}>
                  VERIFY TICKET
                </button>
              </form>
              {verification && (
                <div className="notice">
                  <p>
                    {verification.teamName} · {verification.registrationId}
                    <br />
                    <strong>
                      {verification.status.replaceAll("_", " ").toUpperCase()}
                    </strong>
                  </p>
                  {verification.status === "valid" && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await api("admin/tickets/check-in", {
                            token: tokenValue(),
                          });
                          setVerification({
                            ...verification,
                            status: "already_checked_in",
                          });
                          setMessage("Team checked in successfully.");
                        })
                      }
                    >
                      CONFIRM TEAM CHECK-IN
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
