export function calcCenter(coordinates: { lat: number; lng: number }[]): {
  lat: number;
  lng: number;
} {
  if (coordinates.length === 0) {
    throw new Error('coordinates must not be empty');
  }
  const lat =
    coordinates.reduce((sum, p) => sum + p.lat, 0) / coordinates.length;
  const lng =
    coordinates.reduce((sum, p) => sum + p.lng, 0) / coordinates.length;
  return { lat, lng };
}
