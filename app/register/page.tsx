export const dynamic = "force-dynamic";
import { Header } from "@/components/Header";
import { RegistrationWizard } from "@/components/RegistrationWizard";
import { domains } from "@/lib/config";
export default function RegisterPage() {
  const open =
    process.env.REGISTRATION_OPEN === "true" &&
    process.env.POLICY_APPROVED === "true";

  return (
    <>
      <Header />
      <main id="main" className="page-shell">
        <div className="page-intro">
          <p className="eyebrow gold">
            ARCHIVE ACCESS / {open ? "TEAM REGISTRATION" : "COMING SOON"}
          </p>
          <h1>
            {open ? "Every mission" : "Registration is"}
            <br />
            {open ? "starts with a crew." : "coming soon."}
          </h1>
          <p>
            {open
              ? "Three builders. One registration. Assemble your team and enter the archive."
              : "Registration is not open yet. Follow the event updates and return when access is announced."}
          </p>
        </div>
        <RegistrationWizard
          allowedDomains={domains()}
          open={
            process.env.REGISTRATION_OPEN === "true" &&
            process.env.POLICY_APPROVED === "true"
          }
        />
      </main>
    </>
  );
}
