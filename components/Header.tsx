import Link from "next/link";
import { HolocronLogo } from "./HolocronLogo";
export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="HOL0CRON home">
        <HolocronLogo className="mini-mark" decorative /> HOL0CRON
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#mission">The mission</Link>
        <Link href="/#domains">Challenge domains</Link>
        <Link href="/#brief">Mission brief</Link>
      </nav>
      <Link href="/register" className="header-cta">
        Join the archive <span>↗</span>
      </Link>
    </header>
  );
}
