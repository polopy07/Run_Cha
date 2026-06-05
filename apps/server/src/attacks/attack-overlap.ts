import { Feature, MultiPolygon, Polygon } from 'geojson';
import * as turf from '@turf/turf';

type Coordinate = { lat: number; lng: number };

export type AttackOverlapResult = {
  overlapRate: number;
  contestedAreaSqm: number;
  contestedCoordinates: Coordinate[] | null;
  defenderRemainingAreaSqm: number;
  defenderRemainingCoordinates: Coordinate[] | null;
};

export type PolygonMergeResult = {
  areaSqm: number;
  coordinates: Coordinate[] | null;
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
  const contestedPolygon = intersection
    ? extractLargestPolygon(intersection)
    : null;
  const storableContestedPolygon = contestedPolygon
    ? toStorablePolygon(contestedPolygon)
    : null;
  const contestedAreaSqm = storableContestedPolygon
    ? turf.area(storableContestedPolygon)
    : 0;
  const remaining = contestedPolygon
    ? turf.difference(
        turf.featureCollection([territoryPolygon, contestedPolygon]),
      )
    : territoryPolygon;
  const defenderRemainingPolygon = remaining
    ? extractLargestPolygon(remaining)
    : null;
  const storableDefenderRemainingPolygon = defenderRemainingPolygon
    ? toStorablePolygon(defenderRemainingPolygon)
    : null;
  const defenderRemainingAreaSqm = storableDefenderRemainingPolygon
    ? turf.area(storableDefenderRemainingPolygon)
    : 0;
  const overlapRate =
    territoryAreaSqm > 0 ? (contestedAreaSqm / territoryAreaSqm) * 100 : 0;

  return {
    overlapRate,
    contestedAreaSqm,
    contestedCoordinates: storableContestedPolygon
      ? toCoordinates(storableContestedPolygon)
      : null,
    defenderRemainingAreaSqm,
    defenderRemainingCoordinates: storableDefenderRemainingPolygon
      ? toCoordinates(storableDefenderRemainingPolygon)
      : null,
  };
}

export function mergePolygons(
  baseCoordinates: Coordinate[],
  addedCoordinates: Coordinate[],
): PolygonMergeResult {
  const basePolygon = toPolygon(baseCoordinates);
  const addedPolygon = toPolygon(addedCoordinates);
  const union = turf.union(turf.featureCollection([basePolygon, addedPolygon]));
  const mergedPolygon = union ? extractLargestPolygon(union) : null;

  return {
    areaSqm: mergedPolygon ? turf.area(mergedPolygon) : 0,
    coordinates: mergedPolygon ? toCoordinates(mergedPolygon) : null,
  };
}

export function toPolygon(coordinates: Coordinate[]): Feature<Polygon> {
  if (coordinates.length < 3) {
    throw new Error('폐곡선 좌표가 부족합니다.');
  }

  const ring = coordinates.map((coord) => [coord.lng, coord.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first]);
  }

  return turf.polygon([ring]);
}

function extractLargestPolygon(
  feature: Feature<Polygon | MultiPolygon>,
): Feature<Polygon> | null {
  if (feature.geometry.type === 'Polygon') {
    return turf.polygon(feature.geometry.coordinates);
  }

  let largest: Feature<Polygon> | null = null;
  let largestArea = 0;

  for (const polygonCoordinates of feature.geometry.coordinates) {
    const polygon = turf.polygon(polygonCoordinates);
    const area = turf.area(polygon);

    if (area > largestArea) {
      largest = polygon;
      largestArea = area;
    }
  }

  return largest;
}

function toStorablePolygon(feature: Feature<Polygon>): Feature<Polygon> {
  const outerRing = feature.geometry.coordinates[0];

  return turf.polygon([outerRing]);
}

function toCoordinates(feature: Feature<Polygon>): Coordinate[] {
  return feature.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
}
