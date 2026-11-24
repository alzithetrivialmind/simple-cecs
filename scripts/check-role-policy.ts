/**
 * Uji kebijakan akses peran (src/lib/roles.ts).
 *
 * Aturan CECS: TECHNICIAN & OPERATOR hanya bagian input; laporan, analitik,
 * dan ekspor data hanya untuk SUPERVISOR & ADMIN.
 */

import fs from "fs";
import path from "path";
import {
  REPORT_ROLES,
  INPUT_ROLES,
  canAccessReports,
  canInputData,
  isReportPath,
} from "../src/lib/roles";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else { fail++; console.log(`  FAIL ${name}\n       expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }
}

const ALL_ROLES = ["ADMIN", "SUPERVISOR", "TECHNICIAN", "OPERATOR", "VIEWER"];

console.log("\n== canAccessReports: hanya manajemen ==");
check("ADMIN boleh", canAccessReports("ADMIN"), true);
check("SUPERVISOR boleh", canAccessReports("SUPERVISOR"), true);
check("TECHNICIAN ditolak", canAccessReports("TECHNICIAN"), false);
check("OPERATOR ditolak", canAccessReports("OPERATOR"), false);
check("VIEWER ditolak", canAccessReports("VIEWER"), false);
check("undefined ditolak", canAccessReports(undefined), false);
check("null ditolak", canAccessReports(null), false);
check("string kosong ditolak", canAccessReports(""), false);
check("peran tak dikenal ditolak", canAccessReports("SUPERADMIN"), false);
check("case-sensitive: 'admin' ditolak", canAccessReports("admin"), false);

console.log("== tidak ada peran input yang lolos ==");
{
  const allowed = ALL_ROLES.filter(canAccessReports);
  check("hanya ADMIN & SUPERVISOR", allowed.sort(), ["ADMIN", "SUPERVISOR"]);
  const inputRoles = ["TECHNICIAN", "OPERATOR"];
  check("tak satu pun role input lolos", inputRoles.filter(canAccessReports), []);
}

console.log("== REPORT_ROLES sebagai sumber kebenaran ==");
check("isi REPORT_ROLES", [...REPORT_ROLES].sort(), ["ADMIN", "SUPERVISOR"]);
{
  // Setiap anggota REPORT_ROLES harus lolos canAccessReports, dan sebaliknya.
  const consistent = ALL_ROLES.every(
    (r) => canAccessReports(r) === (REPORT_ROLES as readonly string[]).includes(r)
  );
  check("konstanta & fungsi konsisten", consistent, true);
}

console.log("== VIEWER hanya baca ==");
check("VIEWER tidak boleh input", canInputData("VIEWER"), false);
check("undefined tidak boleh input", canInputData(undefined), false);
check("isi INPUT_ROLES", [...INPUT_ROLES].sort(), ["ADMIN", "OPERATOR", "SUPERVISOR", "TECHNICIAN"]);
{
  // Every action that writes to the database must check the role. Only actions
  // on the user's own account are exempt.
  const OWN_ACCOUNT = ["loginAction", "logoutAction", "updateProfilePhoto", "changePassword"];
  const WRITES = /\b(?:db|tx)\.\w+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\(/;
  const dir = path.join(__dirname, "../src/server/actions");
  let writers = 0;
  for (const file of fs.readdirSync(dir)) {
    const source = fs.readFileSync(path.join(dir, file), "utf8");
    for (const body of source.split(/^export async function /m).slice(1)) {
      const name = body.match(/^\w+/)?.[0] ?? "";
      if (!WRITES.test(body) || OWN_ACCOUNT.includes(name)) continue;
      writers++;
      check(`${file}: ${name} memeriksa peran`, /requireRole\(/.test(body), true);
    }
  }
  check("aksi tulis terdeteksi", writers > 20, true);

  const upload = fs.readFileSync(path.join(dir, "upload.ts"), "utf8");
  check("setiap upload memeriksa akses", upload.split("await requireUploadAccess(folder)").length - 1, 2);
}

console.log("== isReportPath ==");
check("/report cocok", isReportPath("/report"), true);
check("/report/downtime cocok", isReportPath("/report/downtime"), true);
check("/reports TIDAK cocok", isReportPath("/reports"), false);
check("/report-archive TIDAK cocok", isReportPath("/report-archive"), false);
check("/dashboard tidak cocok", isReportPath("/dashboard"), false);
check("/equipment tidak cocok", isReportPath("/equipment"), false);
check("/admin/logs tidak cocok", isReportPath("/admin/logs"), false);

console.log(`\n${fail === 0 ? "OK" : "GAGAL"} — lulus: ${pass}, gagal: ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
