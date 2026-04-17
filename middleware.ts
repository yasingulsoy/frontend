import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/api/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") {
      url.searchParams.set("from", pathname + req.nextUrl.search);
    } else {
      url.searchParams.delete("from");
    }
    const res = NextResponse.redirect(url);
    res.cookies.delete(AUTH_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Next iç varlıklarını ve public statikleri hariç tut.
     * image.png (login ekranı görseli), favicon, robots.txt korunmasız olsun.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|image\\.png|robots\\.txt).*)",
  ],
};
