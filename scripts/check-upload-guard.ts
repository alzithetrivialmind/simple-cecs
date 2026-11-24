import path from "path";
import {
  isSafeFileKey,
  resolveWithinRoot,
  resolveUploadType,
  validateUpload,
  sanitizeFolder,
  contentTypeForKey,
  fileResponseHeaders,
} from "../src/lib/upload-guard";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL ${name}\n       expected=${e}\n       actual  =${a}`);
  }
}

console.log("\n== isSafeFileKey: harus MENOLAK traversal ==");
const malicious = [
  "../../etc/passwd",
  "../server.js",
  "a/../../b",
  "/etc/passwd",
  "..",
  "./x",
  "a//b",
  "foo/../../../app/server.js",
  "general/../../../../etc/shadow",
  "a\\..\\b",
  "C:\\Windows\\System32",
  "file\0.jpg",
  "",
  "x".repeat(600),
];
for (const k of malicious) {
  check(`reject ${JSON.stringify(k).slice(0, 45)}`, isSafeFileKey(k), false);
}

console.log("== isSafeFileKey: harus MENERIMA kunci sah ==");
const benign = [
  "general/1234-abcdef.jpg",
  "work-order/1700000000-aabbcc.png",
  "equipment/foo.webp",
  "a/b/c/d.pdf",
  "..foo/bar.jpg", // titik dua di awal nama, bukan segmen ".."
  "foo..bar.jpg",
];
for (const k of benign) {
  check(`accept ${k}`, isSafeFileKey(k), true);
}

console.log("== resolveWithinRoot: tidak boleh lolos dari root ==");
const root = path.resolve("/app/public/uploads");
check("traversal -> null", resolveWithinRoot(root, "../../server.js"), null);
check("absolute -> null", resolveWithinRoot(root, "/etc/passwd"), null);
check("nested traversal -> null", resolveWithinRoot(root, "a/../../../b"), null);
check(
  "sah -> path di dalam root",
  resolveWithinRoot(root, "general/x.jpg"),
  path.resolve(root, "general/x.jpg")
);
{
  // Properti inti: apa pun hasilnya, ia selalu di dalam root.
  const probes = [...malicious, ...benign];
  const escaped = probes
    .map((k) => resolveWithinRoot(root, k))
    .filter((r): r is string => r !== null)
    .filter((r) => r !== root && !r.startsWith(root + path.sep));
  check("tidak ada hasil yang lolos root", escaped, []);
}

console.log("== resolveUploadType: allowlist ==");
check("text/html ditolak", resolveUploadType("text/html"), null);
check("image/svg+xml ditolak", resolveUploadType("image/svg+xml"), null);
check("app/javascript ditolak", resolveUploadType("application/javascript"), null);
check("kosong ditolak", resolveUploadType(""), null);
check("null ditolak", resolveUploadType(null), null);
check("jpeg diterima", resolveUploadType("image/jpeg"), { mime: "image/jpeg", ext: "jpg" });
check("pjpeg dinormalisasi", resolveUploadType("image/pjpeg"), { mime: "image/jpeg", ext: "jpg" });
check("param charset dibuang", resolveUploadType("image/png; charset=utf-8"), { mime: "image/png", ext: "png" });
check("kapital dinormalisasi", resolveUploadType("IMAGE/PNG"), { mime: "image/png", ext: "png" });

console.log("== validateUpload: magic bytes ==");
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const pdf = Buffer.from("%PDF-1.7\n...");
const webp = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "ascii"),
]);
const html = Buffer.from("<script>alert(document.cookie)</script>", "utf8");

check("jpg valid", validateUpload("image/jpeg", jpg), { ok: true, mime: "image/jpeg", ext: "jpg" });
check("png valid", validateUpload("image/png", png), { ok: true, mime: "image/png", ext: "png" });
check("pdf valid", validateUpload("application/pdf", pdf), { ok: true, mime: "application/pdf", ext: "pdf" });
check("webp valid", validateUpload("image/webp", webp), { ok: true, mime: "image/webp", ext: "webp" });

check(
  "HTML menyamar sebagai jpeg DITOLAK",
  validateUpload("image/jpeg", html).ok,
  false
);
check("HTML apa adanya DITOLAK", validateUpload("text/html", html).ok, false);
check("png isi jpg DITOLAK", validateUpload("image/png", jpg).ok, false);
check("berkas kosong DITOLAK", validateUpload("image/jpeg", Buffer.alloc(0)).ok, false);
check(
  "melebihi 10MB DITOLAK",
  validateUpload("image/jpeg", Buffer.concat([jpg, Buffer.alloc(11 * 1024 * 1024)])).ok,
  false
);

console.log("== sanitizeFolder ==");
check("traversal -> general", sanitizeFolder("../../etc"), "general");
check("slash -> general", sanitizeFolder("a/b"), "general");
check("kosong -> general", sanitizeFolder(""), "general");
check("undefined -> general", sanitizeFolder(undefined), "general");
check("sah dipertahankan", sanitizeFolder("work-order"), "work-order");
check("kapital diturunkan", sanitizeFolder("Equipment"), "equipment");

console.log("== contentTypeForKey & headers ==");
check("ext tak dikenal -> octet-stream", contentTypeForKey("a/b.html"), "application/octet-stream");
check("tanpa ext -> octet-stream", contentTypeForKey("a/b"), "application/octet-stream");
check("jpg -> image/jpeg", contentTypeForKey("a/b.JPG"), "image/jpeg");
{
  const h = fileResponseHeaders("general/evil.html");
  check("html disajikan sbg octet-stream", h["Content-Type"], "application/octet-stream");
  check("html dipaksa attachment", h["Content-Disposition"], "attachment");
  check("CSP sandbox terpasang", h["Content-Security-Policy"], "default-src 'none'; sandbox");
  check("nosniff terpasang", h["X-Content-Type-Options"], "nosniff");
  const img = fileResponseHeaders("general/foto.jpg");
  check("gambar tetap inline", img["Content-Disposition"], "inline");
  const p = fileResponseHeaders("general/doc.pdf");
  check("pdf dipaksa attachment", p["Content-Disposition"], "attachment");
}

console.log(`\n${fail === 0 ? "OK" : "GAGAL"} — lulus: ${pass}, gagal: ${fail}\n`);
process.exit(fail === 0 ? 0 : 1);
