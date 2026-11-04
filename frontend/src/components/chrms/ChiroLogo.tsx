import React from "react";
import { cn } from "@/lib/utils";

type ChiroLogoProps = {
  className?: string;
  /** Visual size of the seal (CSS size). */
  size?: number;
  alt?: string;
};

/** Chiro City Administration seal — use for app chrome and login. */
export function ChiroLogo({
  className,
  size = 40,
  alt = "Chiro City Administration",
}: ChiroLogoProps) {
  return (
    <img
      src="/logo-chiro-512.png"
      srcSet="/logo-chiro-192.png 192w, /logo-chiro-512.png 512w"
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={alt}
      className={cn("shrink-0 object-contain rounded-full", className)}
      decoding="async"
    />
  );
}
