"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { ReminderNotifier } from "@/components/reminders/ReminderNotifier";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ReminderNotifier />
      <AppSidebar />
      <SidebarInset className="flex flex-col flex-1 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background/50 pb-16 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
