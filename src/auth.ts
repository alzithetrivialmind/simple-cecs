import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/validations/auth";
import { isIpRestrictedRole } from "@/lib/roles";
import { checkAdminIp, ipDenialMessage } from "@/lib/ip-allowlist";
import { getClientIp } from "@/lib/client-ip";
import { createAuditLog } from "@/lib/audit";

/** Interval (in seconds) between DB checks for token invalidation */
const REVALIDATION_INTERVAL_S = 60; // 1 minute — bounds how long a revoked session survives

/**
 * Umur mutlak satu sesi, dihitung dari saat login.
 *
 * `session.maxAge` bersifat *rolling*: Auth.js menulis ulang masa berlaku
 * token pada setiap request, sehingga ia berperan sebagai batas idle (8 jam
 * tanpa aktivitas → sesi mati), bukan batas umur. Tanpa batas mutlak, sesi
 * yang terus dipakai — atau cookie yang dicuri dan terus dipakai — hidup
 * selamanya. Batas ini memaksa login ulang sekali per hari kerja panjang.
 */
const ABSOLUTE_SESSION_MAX_S = 12 * 60 * 60; // 12 jam

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 jam (satu shift kerja)
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Initial sign-in: populate token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.nik = user.nik;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.avatarUrl = user.avatarUrl;
        token.lastCheckedAt = Math.floor(Date.now() / 1000);
        // Stable sign-in timestamp. Auth.js re-encodes the JWT on every
        // request with `.setIssuedAt()`, so the standard `iat` claim moves
        // forward continuously and cannot be compared against a revocation
        // time. `authAt` is written once, here, and never refreshed.
        token.authAt = Math.floor(Date.now() / 1000);
        return token;
      }

      const now = Math.floor(Date.now() / 1000);

      // Absolute session lifetime — checked on every request, not just at
      // the revalidation interval, since it needs no DB round-trip.
      const authAt = token.authAt as number | undefined;
      if (authAt !== undefined && now - authAt > ABSOLUTE_SESSION_MAX_S) {
        return null;
      }

      // Periodic revalidation: check if user has been force-logged-out
      const lastChecked = (token.lastCheckedAt as number) || 0;

      if (now - lastChecked > REVALIDATION_INTERVAL_S) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: {
              isActive: true,
              deletedAt: true,
              tokenInvalidBefore: true,
              role: true,
              name: true,
              avatarUrl: true,
            },
          });

          // User deleted or deactivated → drop the session.
          // Returning null makes Auth.js clear the session cookies.
          if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
            return null;
          }

          // Force-logout: session started before tokenInvalidBefore
          if (dbUser.tokenInvalidBefore) {
            const invalidBeforeEpoch = Math.floor(
              dbUser.tokenInvalidBefore.getTime() / 1000
            );
            const authAt = token.authAt as number | undefined;

            // A token minted before `authAt` existed cannot prove when it was
            // issued, so treat it as revoked rather than trusting it.
            if (authAt === undefined || authAt < invalidBeforeEpoch) {
              return null;
            }
          }

          // Refresh mutable fields from DB
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.avatarUrl = dbUser.avatarUrl;
          token.lastCheckedAt = now;
        } catch {
          // DB error → keep existing token, try again next interval
          token.lastCheckedAt = now;
        }
      }

      return token;
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        nik: { label: "NIK", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const { nik, password } = parsedCredentials.data;

        const user = await db.user.findFirst({
          where: {
            nik: {
              equals: nik,
              mode: "insensitive",
            },
            deletedAt: null,
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        if (!user.isActive) {
          throw new Error("Akun Anda telah dinonaktifkan. Hubungi Administrator.");
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        // ── Pembatasan IP untuk akun berprivilese ──────────────
        // Diperiksa di sini, bukan hanya di loginAction, karena endpoint
        // /api/auth/callback/credentials bisa dipanggil langsung dan
        // melewati server action itu. Ini titik cekik yang sebenarnya.
        //
        // Diletakkan SESUDAH verifikasi password supaya tidak menjadi
        // orakel: penyerang dari luar jaringan tidak bisa memetakan NIK
        // mana yang berperan admin hanya dengan membaca pesan error.
        if (isIpRestrictedRole(user.role)) {
          const ip = await getClientIp();
          const verdict = checkAdminIp(ip);

          if (!verdict.allowed) {
            await createAuditLog({
              userId: user.id,
              action: "LOGIN_IP_BLOCKED",
              entity: "Auth",
              entityId: user.nik,
              details:
                verdict.reason === "proxy_misconfigured"
                  ? `Login ${user.role} ditolak: IP terbaca ${ip}, yaitu alamat container. Reverse proxy tidak meneruskan IP asli klien.`
                  : `Login ${user.role} untuk ${user.nik} ditolak dari IP ${ip} (di luar jaringan kantor).`,
            });

            throw new Error(ipDenialMessage(verdict.reason));
          }
        }

        return {
          id: user.id,
          name: user.name,
          nik: user.nik,
          role: user.role,
          departmentId: user.departmentId,
          avatarUrl: user.avatarUrl,
        };
      },
    }),
  ],
});
