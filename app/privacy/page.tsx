import { Header } from "@/components/Header";
export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="page-shell legal">
        <p className="eyebrow gold">POLICY VERSION / 2026-10-v1</p>
        <h1>Privacy notice</h1>
        <p>
          HOL0CRON collects team names and each participant’s name, KIIT roll
          number, university email, phone number, academic year, and school or
          branch to administer registration, confirm eligibility, provide
          admission credentials, and communicate essential event information.
        </p>
        <h2>Who can access your information</h2>
        <p>
          Authorized organizers from AlgoZenith KIIT Chapter, KodeWreck, and the
          School of Computer Engineering, KIIT University can review
          registration information. Public ticket verification displays only
          team name, registration ID, and admission status. Ticket downloads
          include names, but never phone numbers, roll numbers, or email
          addresses.
        </p>
        <h2>Browser storage and credentials</h2>
        <p>
          Your unfinished registration is stored in session storage in this
          browser tab. It is cleared after confirmation. Essential, HTTP-only
          cookies enable secure retrieval and organizer sessions. No marketing
          trackers are used. Keep your recovery key private; it gives access to
          your full team registration.
        </p>
        <h2>Retention and requests</h2>
        <p>
          The proposed policy is deletion or anonymization of participant
          contact and eligibility data within 90 days after the event, subject
          to a documented incident or legal hold. Organizers must approve this
          policy and publish a verified contact channel before registration
          opens. Until then, this notice is a deployment draft.
        </p>
        <p>
          To request access, correction, or deletion after launch, use the
          organizer contact channel published with the official event
          announcement. No unconfirmed email address is listed here.
        </p>
        <h2>Your acknowledgments</h2>
        <p>
          All members must be informed about this notice before their leader
          submits their information. No optional communications or marketing
          consent is bundled into registration.
        </p>
      </main>
    </>
  );
}
