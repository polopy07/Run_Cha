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
  isAdjacent: boolean;
};

export function calculateTerritoryOverlap(
  attackerCoordinates: Coordinate[],
  defenderCoordinates: Coordinate[],
  defenderAreaSqm: number,
): AttackOverlapResult {
  const runningPolygon = toPolygon(attackerCoordinates);
  const territoryPolygon = toPolygon(defenderCoordinates);
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
  const diffResult = contestedPolygon
    ? turf.difference(
        turf.featureCollection([territoryPolygon, contestedPolygon]),
      )
    : null;
  const remaining = diffResult
    ? fixSelfIntersection(diffResult)
    : (contestedPolygon ? null : territoryPolygon);
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
    defenderAreaSqm > 0 ? (contestedAreaSqm / defenderAreaSqm) * 100 : 0;

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

  // union이 Polygon이면 두 영토가 인접/겹침, MultiPolygon이면 비인접
  const isAdjacent = union?.geometry.type === 'Polygon';
  const fixedUnion = union ? fixSelfIntersection(union) : null;
  const mergedPolygon = fixedUnion ? extractLargestPolygon(fixedUnion) : null;

  return {
    areaSqm: mergedPolygon ? turf.area(mergedPolygon) : 0,
    coordinates: mergedPolygon ? toCoordinates(mergedPolygon) : null,
    isAdjacent,
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

  // 1차 스코프는 단일 Polygon 저장 구조를 유지한다.
  // MultiPolygon 결과는 가장 큰 조각만 보존하고 나머지 조각은 버린다.
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

// turf.difference() / turf.union() 결과가 자기교차(self-intersecting) 폴리곤일 경우
// 렌더링 시 fill 없는 선만 보이는 현상이 발생한다.
// unkinkPolygon으로 정리한 뒤 가장 큰 조각을 반환한다.
export function fixSelfIntersection(
  feature: Feature<Polygon | MultiPolygon>,
): Feature<Polygon | MultiPolygon> {
  if (feature.geometry.type !== 'Polygon') {
    return feature;
  }

  const unkinked = turf.unkinkPolygon(feature as Feature<Polygon>);
  if (unkinked.features.length === 0) {
    return feature;
  }
  if (unkinked.features.length === 1) {
    return unkinked.features[0];
  }

  // 여러 조각으로 분리됐으면 가장 큰 조각 반환
  return unkinked.features.reduce((a, b) =>
    turf.area(a) >= turf.area(b) ? a : b,
  );
}
