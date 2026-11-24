import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone only inside Docker (Windows can't create symlinks without admin)
  ...(process.env.DOCKER_BUILD === "1" && { output: "standalone" as const }),
  outputFileTracingRoot: path.join(__dirname),
  reactStrictMode: true,
  // Jangan umumkan framework lewat header X-Powered-By
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-eval' dibuang: build produksi Next.js tidak membutuhkannya.
              // 'unsafe-inline' masih diperlukan skrip bootstrap Next;
              // langkah berikutnya menggantinya dengan nonce.
              // Hanya `next dev` (React Refresh) yang butuh 'unsafe-eval'.
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              // Lampiran disajikan lewat /api/files, jadi 'self' sudah cukup.
              // Sumber MinIO sebelumnya adalah aturan mati: nilainya dievaluasi
              // saat build (saat MINIO_ENDPOINT belum diset) sehingga menjadi
              // http://localhost:9000, alamat yang tidak pernah dipakai.
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

