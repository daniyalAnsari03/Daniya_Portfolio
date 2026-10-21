import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const reason = searchParams.get("reason");

  const supabase = await createClient();
  await supabase.auth.signOut();

  const target =
    reason === "not-authorized"
      ? `${origin}/admin/login?error=not-authorized`
      : `${origin}/admin/login`;

  return NextResponse.redirect(target);
}
