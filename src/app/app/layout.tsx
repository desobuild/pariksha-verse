import * as React from "react";
import { AppHeader } from "@/components/navigation/app-header";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { MobileBottomNav, MobileBottomNavSpacer } from "@/components/navigation/mobile-bottom-nav";

/**
 * App shell. On mobile the document is the single scroll container: main
 * grows with its content (no overflow/height constraint of its own) and the
 * bottom-nav inset spacer is rendered INSIDE main, after the page content,
 * so the final content can always scroll clear of the fixed bottom nav.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dynamic bg-background">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1">
          {children}
          <MobileBottomNavSpacer />
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
