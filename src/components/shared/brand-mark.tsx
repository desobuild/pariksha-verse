import Image from "next/image";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils/cn";

export interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The approved ParikshaVerse brand icon (design/screens/ParikshaVerse Icon.svg),
 * served from /icon.svg. Decorative — pair with a visible wordmark.
 */
export function BrandMark({ size = 32, className }: BrandMarkProps) {
  return (
    <Image
      src={BRAND.logo.icon}
      alt=""
      width={size}
      height={size}
      priority
      aria-hidden="true"
      className={cn("shrink-0 rounded-[26%] shadow-subtle select-none", className)}
    />
  );
}
