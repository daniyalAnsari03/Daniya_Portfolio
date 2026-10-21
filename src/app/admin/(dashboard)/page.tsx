import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function AdminDashboardPage() {
  return <h1 className="text-2xl font-medium tracking-[-0.03em]">Dashboard</h1>;
}
