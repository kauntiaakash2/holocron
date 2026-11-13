import { Header } from "@/components/Header";
import { RegistrationDetails } from "@/components/RegistrationDetails";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <Header />
      <main id="main" className="page-shell">
        <RegistrationDetails id={id} />
      </main>
    </>
  );
}
