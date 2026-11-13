export const dynamic = "force-dynamic";
import { Header } from "@/components/Header";
import { RegistrationWizard } from "@/components/RegistrationWizard";
import { domains } from "@/lib/config";
export default function RegisterPage() {
  return (
    <>
      <Header />
      <main id="main" className="page-shell">
        <div className="page-intro">
          <p className="eyebrow gold">ARCHIVE ACCESS / TEAM REGISTRATION</p>
          <h1>
            Every mission
            <br />
            starts with a crew.
          </h1>
          <p>
            Three builders. One registration. Assemble your team and enter the
            archive.
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
