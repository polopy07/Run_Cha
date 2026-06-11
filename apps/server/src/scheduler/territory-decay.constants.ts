// Keep inactiveDays in descending order.
// TerritoryDecayService uses the previous item as the upper boundary.
export const TERRITORY_DECAY_TIERS = [
  { inactiveDays: 22, occupationRate: 0 },
  { inactiveDays: 15, occupationRate: 25 },
  { inactiveDays: 8, occupationRate: 50 },
  { inactiveDays: 4, occupationRate: 75 },
] as const;

export const DAY_IN_MS = 86_400_000;
