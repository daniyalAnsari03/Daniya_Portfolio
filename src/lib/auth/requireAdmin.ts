import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("settings")
    .select("value")
    .eq("key", "admin_emails")
    .maybeSingle();

  const allowlist = Array.isArray(row?.value) ? row.value : [];
  const email = user.email.toLowerCase();
  const allowed = allowlist.some(
    (entry: unknown) =>
      typeof entry === "string" && entry.trim().toLowerCase() === email,
  );

  if (!allowed) {
    // A route handler signs the user out (Server Components cannot write
    // cookies) and sends them back to the login page with an error flag.
    redirect("/auth/signout?reason=not-authorized");
  }

  return { user };
}
