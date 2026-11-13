"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="main" className="page-shell">
      <p className="eyebrow gold">TRANSMISSION INTERRUPTED</p>
      <h1>The archive is temporarily unavailable.</h1>
      <p>
        Your saved registration remains in the database. Retry without starting
        a new submission.
      </p>
      <button className="button" onClick={reset}>
        TRY AGAIN ↗
      </button>
    </main>
  );
}
