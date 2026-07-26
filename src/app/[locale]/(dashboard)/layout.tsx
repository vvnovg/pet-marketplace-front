"use client";

import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <DashboardNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
