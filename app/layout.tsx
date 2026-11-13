import type { Metadata } from "next";
import "@fontsource/yatra-one/latin-400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "HOL0CRON — The Forbidden Archive",
  description:
    "Build what comes next. A product-building hackathon for the competitive programming ecosystem. 22 December 2026, KIIT University.",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
