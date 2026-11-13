import Link from "next/link";
import { Header } from "@/components/Header";
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="page-shell">
        <p className="eyebrow gold">ARCHIVE / 404</p>
        <h1>This record is beyond the archive.</h1>
        <Link className="button" href="/">
          RETURN HOME ↗
        </Link>
      </main>
    </>
  );
}
