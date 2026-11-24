import { test } from "node:test";
import assert from "node:assert/strict";
import { PmBasis, PmStatus } from "@prisma/client";
import { calculatePmStatus } from "./pm-status";

const DAY = 24 * 60 * 60 * 1000;

test("HOUR_METER: nextDueHour = lastDoneHour + intervalHour", () => {
  const r = calculatePmStatus(
    { basis: PmBasis.HOUR_METER, intervalHour: 250, lastDoneHour: 1000 },
    1100
  );
  assert.equal(r.nextDueHour, 1250);
  assert.equal(r.remainingHours, 150);
  assert.equal(r.status, PmStatus.UPCOMING);
});

test("HOUR_METER: DUE hanya jika sisa kurang dari 10 persen interval", () => {
  const plan = { basis: PmBasis.HOUR_METER, intervalHour: 250, lastDoneHour: 1000 };
  // sisa tepat 25 jam (= 10 persen) masih UPCOMING
  assert.equal(calculatePmStatus(plan, 1225).status, PmStatus.UPCOMING);
  // sisa 24 jam sudah DUE
  assert.equal(calculatePmStatus(plan, 1226).status, PmStatus.DUE);
});

test("HOUR_METER: OVERDUE jika currentHourMeter >= nextDueHour", () => {
  const plan = { basis: PmBasis.HOUR_METER, intervalHour: 250, lastDoneHour: 1000 };
  assert.equal(calculatePmStatus(plan, 1250).status, PmStatus.OVERDUE);
  assert.equal(calculatePmStatus(plan, 1400).status, PmStatus.OVERDUE);
});

test("HOUR_METER: belum pernah dikerjakan dihitung dari jam 0", () => {
  const r = calculatePmStatus({ basis: PmBasis.HOUR_METER, intervalHour: 500 }, 100);
  assert.equal(r.nextDueHour, 500);
});

test("CALENDAR: nextDueDate = lastDoneDate + intervalDays", () => {
  const lastDoneDate = new Date("2026-01-01T00:00:00Z");
  const r = calculatePmStatus(
    { basis: PmBasis.CALENDAR, intervalDays: 30, lastDoneDate },
    0,
    new Date("2026-01-10T00:00:00Z")
  );
  assert.equal(r.nextDueDate?.toISOString(), "2026-01-31T00:00:00.000Z");
  assert.equal(r.status, PmStatus.UPCOMING);
});

test("CALENDAR: DUE hanya jika sisa kurang dari 7 hari", () => {
  const lastDoneDate = new Date("2026-01-01T00:00:00Z");
  const plan = { basis: PmBasis.CALENDAR, intervalDays: 30, lastDoneDate };
  const due = new Date("2026-01-31T00:00:00Z").getTime();
  assert.equal(calculatePmStatus(plan, 0, new Date(due - 7 * DAY)).status, PmStatus.UPCOMING);
  assert.equal(calculatePmStatus(plan, 0, new Date(due - 6 * DAY)).status, PmStatus.DUE);
});

test("CALENDAR: OVERDUE hanya setelah nextDueDate terlewati", () => {
  const lastDoneDate = new Date("2026-01-01T00:00:00Z");
  const plan = { basis: PmBasis.CALENDAR, intervalDays: 30, lastDoneDate };
  const due = new Date("2026-01-31T00:00:00Z").getTime();
  assert.equal(calculatePmStatus(plan, 0, new Date(due)).status, PmStatus.DUE);
  assert.equal(calculatePmStatus(plan, 0, new Date(due + 1)).status, PmStatus.OVERDUE);
});

test("CALENDAR: belum pernah dikerjakan dihitung dari createdAt", () => {
  const createdAt = new Date("2026-03-01T00:00:00Z");
  const r = calculatePmStatus(
    { basis: PmBasis.CALENDAR, intervalDays: 10, createdAt },
    0,
    new Date("2026-03-02T00:00:00Z")
  );
  assert.equal(r.nextDueDate?.toISOString(), "2026-03-11T00:00:00.000Z");
});
