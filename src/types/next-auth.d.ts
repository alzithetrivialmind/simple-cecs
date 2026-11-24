import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    name?: string | null;
    nik?: string;
    role?: Role;
    departmentId?: string | null;
    avatarUrl?: string | null;
  }

  interface Session {
    user: {
      id?: string;
      name?: string | null;
      nik?: string;
      role?: Role;
      departmentId?: string | null;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    name?: string | null;
    nik?: string;
    role?: Role;
    departmentId?: string | null;
    avatarUrl?: string | null;
    /**
     * Epoch seconds when this session was established. Written once at
     * sign-in and never refreshed, unlike the standard `iat` claim which
     * Auth.js rewrites on every request. Compared against
     * `User.tokenInvalidBefore` to enforce force-logout.
     */
    authAt?: number;
    /** Epoch seconds of the last DB revalidation of this token. */
    lastCheckedAt?: number;
  }
}
