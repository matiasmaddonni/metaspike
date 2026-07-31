import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing point. Supabase redirects here with a one-time `code`,
 * which is exchanged for a session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/loan";

  if (!code) {
    return NextResponse.redirect(`${origin}/loan/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/loan/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Only same-origin relative paths — an open redirect here would hand a
  // freshly minted session to whatever URL an attacker put in the link.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/loan";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
