import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Simple Role-Based Protection Example
    // If user is trying to access /settings, restrict to SUPER_ADMIN or HR_ADMIN
    if (path.startsWith("/settings")) {
      if (token?.role !== "SUPER_ADMIN" && token?.role !== "HR_ADMIN") {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
    }

    // Similarly protect /employees from standard employees
    if (path.startsWith("/employees") && token?.role === "EMPLOYEE") {
        return NextResponse.redirect(new URL("/portal", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api/auth (NextAuth routes)
     * - login (auth page)
     * - _next (static files)
     * - favicon.ico, images, etc.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login).*)",
  ],
};
