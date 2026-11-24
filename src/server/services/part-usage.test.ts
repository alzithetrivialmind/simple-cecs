import { test } from "node:test";
import assert from "node:assert/strict";
import { rankTopUnits } from "./part-usage";

const crane = { id: "eq1", code: "CRN-001", name: "Crane 1" };
const forklift = { id: "eq2", code: "FLT-001", name: "Forklift 1" };
const genset = { id: "eq3", code: "GEN-001", name: "Genset 1" };

test("rankTopUnits: urut berdasarkan jumlah pemakaian lalu total qty", () => {
  const r = rankTopUnits([
    { qty: 1, usedAt: new Date("2026-01-01"), equipment: crane },
    { qty: 1, usedAt: new Date("2026-02-01"), equipment: crane },
    { qty: 5, usedAt: new Date("2026-03-01"), equipment: forklift },
    { qty: 2, usedAt: new Date("2026-03-02"), equipment: genset },
  ]);
  assert.deepEqual(
    r.map((u) => u.code),
    ["CRN-001", "FLT-001", "GEN-001"]
  );
  assert.equal(r[0].usageCount, 2);
  assert.equal(r[0].totalQty, 2);
  assert.equal(r[0].lastUsedAt.toISOString(), new Date("2026-02-01").toISOString());
});

test("rankTopUnits: membatasi hasil dan aman untuk data kosong", () => {
  assert.deepEqual(rankTopUnits([]), []);
  const r = rankTopUnits(
    [
      { qty: 1, usedAt: new Date("2026-01-01"), equipment: crane },
      { qty: 1, usedAt: new Date("2026-01-01"), equipment: forklift },
    ],
    1
  );
  assert.equal(r.length, 1);
});
