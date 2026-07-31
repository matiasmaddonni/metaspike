import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase session on every matched request.
 *
 * Server Components cannot write cookies, so a token that expires mid-session
 * can only be refreshed here. Without this, a user appears logged in until the
 * access token lapses and then silently starts reading as anon — which, with
 * metaloan's RLS, looks like an empty collection rather than an auth error.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates against the auth server. Do not swap this for
  // getSession(), which trusts the cookie without checking it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoanRoute = request.nextUrl.pathname.startsWith("/loan");
  const isLoginRoute = request.nextUrl.pathname.startsWith("/loan/login");

  if (isLoanRoute && !isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/loan/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/loan";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
