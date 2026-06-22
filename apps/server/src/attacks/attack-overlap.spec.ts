import * as turf from '@turf/turf';
import {
  calculateTerritoryOverlap,
  fixSelfIntersection,
  mergePolygons,
  toPolygon,
} from './attack-overlap';

const SQUARE = [
  { lat: 37.0, lng: 127.0 },
  { lat: 37.0, lng: 127.001 },
  { lat: 37.001, lng: 127.001 },
  { lat: 37.001, lng: 127.0 },
  { lat: 37.0, lng: 127.0 },
];

const HALF_SQUARE = [
  { lat: 37.0, lng: 127.0 },
  { lat: 37.0, lng: 127.0005 },
  { lat: 37.001, lng: 127.0005 },
  { lat: 37.001, lng: 127.0 },
  { lat: 37.0, lng: 127.0 },
];

const FAR_SQUARE = [
  { lat: 37.01, lng: 127.01 },
  { lat: 37.01, lng: 127.011 },
  { lat: 37.011, lng: 127.011 },
  { lat: 37.011, lng: 127.01 },
  { lat: 37.01, lng: 127.01 },
];

const INNER_SQUARE = [
  { lat: 37.00025, lng: 127.00025 },
  { lat: 37.00025, lng: 127.00075 },
  { lat: 37.00075, lng: 127.00075 },
  { lat: 37.00075, lng: 127.00025 },
  { lat: 37.00025, lng: 127.00025 },
];

const VERTICAL_CUT = [
  { lat: 36.9999, lng: 127.0007 },
  { lat: 36.9999, lng: 127.0008 },
  { lat: 37.0011, lng: 127.0008 },
  { lat: 37.0011, lng: 127.0007 },
  { lat: 36.9999, lng: 127.0007 },
];

const LARGER_REMAINING_PIECE = [
  { lat: 37.0, lng: 127.0 },
  { lat: 37.0, lng: 127.0007 },
  { lat: 37.001, lng: 127.0007 },
  { lat: 37.001, lng: 127.0 },
  { lat: 37.0, lng: 127.0 },
];

describe('attack overlap', () => {
  const territoryAreaSqm = turf.area(toPolygon(SQUARE));

  it('calculates full overlap when running path covers territory', () => {
    const result = calculateTerritoryOverlap(SQUARE, SQUARE, territoryAreaSqm);

    expect(result.contestedAreaSqm).toBeCloseTo(territoryAreaSqm, 5);
    expect(result.overlapRate).toBeCloseTo(100, 5);
    expect(result.contestedCoordinates).toHaveLength(5);
    expect(result.defenderRemainingAreaSqm).toBe(0);
    expect(result.defenderRemainingCoordinates).toBeNull();
  });

  it('calculates partial overlap based on territory area', () => {
    const result = calculateTerritoryOverlap(
      HALF_SQUARE,
      SQUARE,
      territoryAreaSqm,
    );

    expect(result.overlapRate).toBeGreaterThan(49);
    expect(result.overlapRate).toBeLessThan(51);
    expect(result.contestedCoordinates).toHaveLength(5);
    expect(result.defenderRemainingAreaSqm).toBeGreaterThan(0);
    expect(result.defenderRemainingCoordinates).toHaveLength(5);
  });

  it('keeps stored defender coordinates and area consistent when remaining polygon has a hole', () => {
    const result = calculateTerritoryOverlap(
      INNER_SQUARE,
      SQUARE,
      territoryAreaSqm,
    );

    expect(result.defenderRemainingCoordinates).toHaveLength(5);
    expect(result.defenderRemainingAreaSqm).toBeCloseTo(
      turf.area(toPolygon(result.defenderRemainingCoordinates ?? [])),
      5,
    );
  });

  it('stores only the largest defender piece when difference returns MultiPolygon', () => {
    const result = calculateTerritoryOverlap(
      VERTICAL_CUT,
      SQUARE,
      territoryAreaSqm,
    );

    const expectedLargestAreaSqm = turf.area(toPolygon(LARGER_REMAINING_PIECE));

    expect(result.defenderRemainingCoordinates).toHaveLength(5);
    expect(result.defenderRemainingAreaSqm).toBeCloseTo(
      expectedLargestAreaSqm,
      0,
    );
    expect(
      Math.max(
        ...(result.defenderRemainingCoordinates ?? []).map(({ lng }) => lng),
      ),
    ).toBeLessThanOrEqual(127.0007);
  });

  it('returns zero overlap when polygons do not intersect', () => {
    const result = calculateTerritoryOverlap(FAR_SQUARE, SQUARE, territoryAreaSqm);

    expect(result.contestedAreaSqm).toBe(0);
    expect(result.overlapRate).toBe(0);
    expect(result.contestedCoordinates).toBeNull();
    expect(result.defenderRemainingAreaSqm).toBeCloseTo(territoryAreaSqm, 5);
    expect(result.defenderRemainingCoordinates).toHaveLength(5);
  });

  it('returns zero rate when territory area is zero', () => {
    const result = calculateTerritoryOverlap(SQUARE, SQUARE, 0);

    expect(result.contestedAreaSqm).toBeGreaterThan(0);
    expect(result.overlapRate).toBe(0);
  });

  it('merges acquired polygon into the attacker territory polygon', () => {
    const result = mergePolygons(HALF_SQUARE, SQUARE);

    expect(result.areaSqm).toBeCloseTo(territoryAreaSqm, 0);
    expect(result.coordinates).toHaveLength(5);
    expect(result.isAdjacent).toBe(true);
  });

  it('returns isAdjacent false when polygons do not touch', () => {
    const result = mergePolygons(HALF_SQUARE, FAR_SQUARE);

    expect(result.isAdjacent).toBe(false);
    expect(result.coordinates).not.toBeNull();
  });

  it('fixes self-intersecting bowtie polygon', () => {
    const BOWTIE = [
      { lat: 37.0, lng: 127.0 },
      { lat: 37.001, lng: 127.001 },
      { lat: 37.001, lng: 127.0 },
      { lat: 37.0, lng: 127.001 },
      { lat: 37.0, lng: 127.0 },
    ];
    const bowtieArea = turf.area(toPolygon(BOWTIE));
    const squareArea = turf.area(toPolygon(SQUARE));
    const fixed = fixSelfIntersection(toPolygon(BOWTIE));

    expect(turf.area(fixed)).toBeGreaterThan(0);
    expect(turf.area(fixed)).toBeLessThan(squareArea);
    expect(turf.area(fixed)).not.toBeCloseTo(bowtieArea, 0);
  });

  it('returns MultiPolygon input unchanged from fixSelfIntersection', () => {
    const multiPolygon = turf.multiPolygon([
      [SQUARE.map(({ lat, lng }) => [lng, lat])],
      [FAR_SQUARE.map(({ lat, lng }) => [lng, lat])],
    ]);
    const result = fixSelfIntersection(multiPolygon);

    expect(result).toBe(multiPolygon);
  });

  it('closes an open ring automatically', () => {
    const polygon = toPolygon(SQUARE.slice(0, -1));
    const ring = polygon.geometry.coordinates[0];

    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(ring[0]).not.toBe(ring[ring.length - 1]);
  });

  it('throws Error when coordinates are insufficient', () => {
    expect(() =>
      toPolygon([
        { lat: 37.0, lng: 127.0 },
        { lat: 37.0, lng: 127.001 },
      ]),
    ).toThrow('폐곡선 좌표가 부족합니다.');
  });
});
