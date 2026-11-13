import { Header } from "@/components/Header";
import { AdminDashboard } from "@/components/AdminDashboard";
export const metadata = { robots: { index: false, follow: false } };
export default function AdminPage() {
  return (
    <>
      <Header />
      <main id="main" className="page-shell">
        <AdminDashboard />
      </main>
    </>
  );
}
