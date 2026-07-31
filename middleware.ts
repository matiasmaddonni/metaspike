import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // metaspike's own routes are anon-readable public data and are deliberately
  // left out — only /loan needs a session. Static assets and images excluded so
  // every page load does not cost an auth round trip.
  matcher: ["/loan/:path*", "/auth/:path*"],
};
