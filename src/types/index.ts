/**
 * Global shared types for ParikshaVerse Foundation
 */

export type ThemeMode = "light" | "dark" | "system";

export interface NavItem {
  title: string;
  href: string;
  iconName: string;
  badge?: string;
  isDesktopOnly?: boolean;
}
