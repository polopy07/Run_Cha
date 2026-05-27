import { Feature, Polygon } from 'geojson';
import * as turf from '@turf/turf';

type Coordinate = { lat: number; lng: number };

export type AttackOverlapResult = {
  overlapRate: number;
  contestedAreaSqm: number;
};

export function calculateAttackOverlap(
  runningPath: Coordinate[],
  territoryCoordinates: Coordinate[],
  territoryAreaSqm: number,
): AttackOverlapResult {
  const runningPolygon = toPolygon(runningPath);
  const territoryPolygon = toPolygon(territoryCoordinates);
  const intersection = turf.intersect(
    turf.featureCollection([runningPolygon, territoryPolygon]),
  );
  const contestedAreaSqm = intersection ? turf.area(intersection) : 0;
  const overlapRate =
    territoryAreaSqm > 0 ? (contestedAreaSqm / territoryAreaSqm) * 100 : 0;

  return { overlapRate, contestedAreaSqm };
}

export function toPolygon(coordinates: Coordinate[]): Feature<Polygon> {
  if (coordinates.length < 3) {
    throw new Error('폐곡선 좌표가 부족합니다.');
  }

  const ring = coordinates.map((coord) => [coord.lng, coord.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  return turf.polygon([ring]);
}
