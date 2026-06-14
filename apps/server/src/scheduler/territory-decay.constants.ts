// Keep inactiveDays in descending order.
// TerritoryDecayService uses the previous item as the upper boundary.
export const TERRITORY_DECAY_TIERS = [
  { inactiveDays: 22, occupationRate: 0 },
  { inactiveDays: 15, occupationRate: 25 },
  { inactiveDays: 8, occupationRate: 50 },
  { inactiveDays: 4, occupationRate: 75 },
] as const;

export const DEFENSE_DECAY_GRACE_LEVEL_STEP = 5;
export const MAX_DEFENSE_DECAY_GRACE_DAYS = 3;
