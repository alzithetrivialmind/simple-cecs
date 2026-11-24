import os from "os";

/**
 * Mendapatkan IP Address LAN IPv4 dari server mesin host (bukan 127.0.0.1/localhost).
 * Digunakan agar QR Code yang dicetak di alat berat dapat di-scan langsung oleh HP di jaringan yang sama.
 */
export function getServerLanIp(): string {
  // Prioritaskan LAN_IP atau HOST_IP dari env jika diset
  if (process.env.LAN_IP) return process.env.LAN_IP;
  if (process.env.HOST_IP) return process.env.HOST_IP;

  try {
    const interfaces = os.networkInterfaces();

    // 1. Prioritaskan subnet fisik 192.168.x.x (Ethernet / Wi-Fi)
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (
          net.family === "IPv4" &&
          !net.internal &&
          net.address.startsWith("192.168.")
        ) {
          return net.address;
        }
      }
    }

    // 2. Cari subnet 10.x.x.x jika ada
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (
          net.family === "IPv4" &&
          !net.internal &&
          net.address.startsWith("10.")
        ) {
          return net.address;
        }
      }
    }

    // 3. Fallback: ambil IPv4 yang bukan loopback, bukan 169.254 (APIPA), dan bukan 172. (WSL/Docker)
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (
          net.family === "IPv4" &&
          !net.internal &&
          !net.address.startsWith("169.254.") &&
          !net.address.startsWith("172.")
        ) {
          return net.address;
        }
      }
    }
  } catch {
    // Fallback jika terjadi kendala membaca network interface
  }

  return "localhost";
}

/**
 * Mendapatkan Base URL jaringan server, diprioritaskan IP Address LAN.
 */
export function getServerNetworkUrl(): string {
  const port = process.env.PORT || "3000";

  // Cek apakah ada NEXTAUTH_URL atau APP_URL yang sudah berupa IP atau domain selain localhost
  const configuredUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl && !configuredUrl.includes("localhost") && !configuredUrl.includes("127.0.0.1")) {
    return configuredUrl.replace(/\/$/, "");
  }

  const lanIp = getServerLanIp();
  return `http://${lanIp}:${port}`;
}
