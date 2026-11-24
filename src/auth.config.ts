import type { NextAuthConfig } from "next-auth";
import { canAccessReports, isReportPath } from "@/lib/roles";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isAuthRoute = pathname.startsWith("/login");
      const isApiAuthRoute = pathname.startsWith("/api/auth");
      const isPublicStatic =
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon.ico") ||
        pathname.startsWith("/icons");

      if (isApiAuthRoute || isPublicStatic) {
        return true;
      }

      if (isAuthRoute) {
        return true;
      }

      // Admin sub-routes require ADMIN role
      if (pathname.startsWith("/admin")) {
        if (!isLoggedIn) {
          return false;
        }
        if (auth.user?.role !== "ADMIN") {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Reporting & analytics are management-only (SUPERVISOR/ADMIN).
      // Technicians and operators are input-side roles.
      if (isReportPath(pathname)) {
        if (!isLoggedIn) {
          return false;
        }
        if (!canAccessReports(auth.user?.role)) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // All other routes require login
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.nik = user.nik;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.avatarUrl = user.avatarUrl;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        if (token.id) session.user.id = token.id;
        if (token.name) session.user.name = token.name;
        session.user.nik = token.nik;
        if (token.role) session.user.role = token.role;
        session.user.departmentId = token.departmentId;
        session.user.avatarUrl = token.avatarUrl;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
