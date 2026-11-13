import { Header } from "@/components/Header";
import { Verification } from "@/components/Verification";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <>
      <Header />
      <main id="main" className="page-shell">
        <Verification token={(await params).token} />
      </main>
    </>
  );
}
