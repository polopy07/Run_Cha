export function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(1)}만 m²`;
  return `${Math.round(sqm).toLocaleString()} m²`;
}

export function formatAreaCompact(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(1)}km²`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(1)}만m²`;
  return `${Math.round(sqm).toLocaleString()}m²`;
}
