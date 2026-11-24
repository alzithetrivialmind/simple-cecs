import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /**
     * Semua rute kecuali yang punya mekanisme autentikasinya sendiri.
     *
     * - api/auth   : ditangani Auth.js
     * - api/cron   : dijaga header x-cron-token. Sebelumnya ikut tertangkap
     *                middleware, sehingga request cron dialihkan ke /login dan
     *                token tidak pernah sempat diperiksa — job PM & digest
     *                praktis tidak pernah berjalan. Akses dari luar diblokir
     *                di lapisan Nginx (lihat nginx/nginx.conf).
     * - api/health : dipakai HEALTHCHECK Docker dari dalam container. Bila
     *                ikut dilindungi, ia membalas 307 ke /login dan
     *                `curl -f` tetap sukses, sehingga container selalu
     *                dilaporkan sehat walau database mati. Diblokir dari
     *                internet di lapisan Nginx.
     */
    "/((?!api/auth|api/cron|api/health|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
