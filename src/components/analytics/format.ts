import { diffLocalDays } from "@/domain/revision";

/** Local-calendar relative day label ("Today", "Yesterday", "12 Jan"). */
export function formatRelativeDay(d: Date, referenceDate: Date = new Date()): string {
  const diff = diffLocalDays(d, referenceDate);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
