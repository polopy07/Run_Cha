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

export function formatProtectionRemaining(protectedUntil: string): string {
  const remainMs = new Date(protectedUntil).getTime() - Date.now();
  if (remainMs <= 0) return '';
  const totalMinutes = Math.ceil(remainMs / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}
