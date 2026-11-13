import Image from "next/image";

/** The supplied HOL0CRON emblem, with the same asset used throughout the site. */
export function HolocronLogo({
  size = 32,
  className,
  decorative = false,
}: {
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <Image
      src="/brand/holocron-logo.webp"
      width={size}
      height={size}
      sizes={`${size}px`}
      alt={decorative ? "" : "HOL0CRON emblem"}
      className={className}
      loading="eager"
    />
  );
}
