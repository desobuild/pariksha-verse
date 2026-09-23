import * as React from "react";
import { AppHeader } from "@/components/navigation/app-header";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
