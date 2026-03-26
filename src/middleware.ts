import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { ROUTE_PERMISSIONS, hasAnyPermission } from "@/lib/rbac";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role as string;

    // Employee users can only access employee portal & profile routes
    if (role === "EMPLOYEE") {
      const allowedPrefixes = ["/employee", "/profile", "/api"];
      const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix));
      if (!isAllowed && path !== "/") {
        return NextResponse.redirect(new URL("/employee/dashboard", req.url));
      }
      // Redirect root to employee dashboard
      if (path === "/") {
        return NextResponse.redirect(new URL("/employee/dashboard", req.url));
      }
    }

    // Check route permissions for protected routes
    for (const [routePattern, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
      if (path.startsWith(routePattern)) {
        if (!hasAnyPermission(role, permissions)) {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
        break;
      }
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
