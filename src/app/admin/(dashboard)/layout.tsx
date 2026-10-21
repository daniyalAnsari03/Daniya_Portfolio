import type { ReactNode } from "react";
import { connection } from "next/server";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const instant = false;

export default async function AdminGuardedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  const { user } = await requireAdmin();

  return <AdminShell email={user.email ?? ""}>{children}</AdminShell>;
}
