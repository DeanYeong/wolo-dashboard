import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
 
type CookieToSet = { name: string; value: string; options?: CookieOptions };
 
// Every page needs a signed-in user. Signed-out visitors go to /login.
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
 
  // Without these two settings the Supabase client throws, which Vercel shows as a bare 500.
  // Say what is missing instead.
  if (!url || !key) {
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_ANON_KEY"].filter(Boolean).join(" and ");
    return new NextResponse(
      `Setup needed: ${missing} ${missing.includes(" and ") ? "are" : "is"} not set on this deployment. ` +
        "Add it in Vercel > Project > Settings > Environment Variables (for Production), then redeploy.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
 
  let response = NextResponse.next({ request });
  let signedIn = false;
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: CookieToSet[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    signedIn = !!data.user;
  } catch {
    // Bad URL or key, or Supabase unreachable: treat as signed out so /login can show the real error.
    signedIn = false;
  }
 
  const onLogin = request.nextUrl.pathname.startsWith("/login");
  if (!signedIn && !onLogin) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    return NextResponse.redirect(to);
  }
  if (signedIn && onLogin) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    return NextResponse.redirect(to);
  }
  return response;
}
 
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
