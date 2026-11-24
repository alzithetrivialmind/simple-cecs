export interface UsageForRanking {
  qty: number;
  usedAt: Date;
  equipment: { id: string; code: string; name: string };
}

export interface TopUnit {
  equipmentId: string;
  code: string;
  name: string;
  usageCount: number;
  totalQty: number;
  lastUsedAt: Date;
}

/**
 * Ranks units by how often they used a part: most usage events first,
 * then largest total quantity, then most recent use.
 */
export function rankTopUnits(usages: UsageForRanking[], limit = 10): TopUnit[] {
  const byUnit = new Map<string, TopUnit>();

  for (const u of usages) {
    const current = byUnit.get(u.equipment.id);
    if (current) {
      current.usageCount += 1;
      current.totalQty += u.qty;
      if (u.usedAt > current.lastUsedAt) current.lastUsedAt = u.usedAt;
    } else {
      byUnit.set(u.equipment.id, {
        equipmentId: u.equipment.id,
        code: u.equipment.code,
        name: u.equipment.name,
        usageCount: 1,
        totalQty: u.qty,
        lastUsedAt: u.usedAt,
      });
    }
  }

  return [...byUnit.values()]
    .sort(
      (a, b) =>
        b.usageCount - a.usageCount ||
        b.totalQty - a.totalQty ||
        b.lastUsedAt.getTime() - a.lastUsedAt.getTime()
    )
    .slice(0, limit);
}
