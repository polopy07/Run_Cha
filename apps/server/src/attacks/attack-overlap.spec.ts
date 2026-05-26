import * as turf from '@turf/turf';
import { calculateAttackOverlap, toPolygon } from './attack-overlap';

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

describe('attack overlap', () => {
  const territoryAreaSqm = turf.area(toPolygon(SQUARE));

  it('calculates full overlap when running path covers territory', () => {
    const result = calculateAttackOverlap(SQUARE, SQUARE, territoryAreaSqm);

    expect(result.contestedAreaSqm).toBeCloseTo(territoryAreaSqm, 5);
    expect(result.overlapRate).toBeCloseTo(100, 5);
  });

  it('calculates partial overlap based on territory area', () => {
    const result = calculateAttackOverlap(
      HALF_SQUARE,
      SQUARE,
      territoryAreaSqm,
    );

    expect(result.overlapRate).toBeGreaterThan(49);
    expect(result.overlapRate).toBeLessThan(51);
  });

  it('returns zero overlap when polygons do not intersect', () => {
    const result = calculateAttackOverlap(FAR_SQUARE, SQUARE, territoryAreaSqm);

    expect(result.contestedAreaSqm).toBe(0);
    expect(result.overlapRate).toBe(0);
  });

  it('returns zero rate when territory area is zero', () => {
    const result = calculateAttackOverlap(SQUARE, SQUARE, 0);

    expect(result.contestedAreaSqm).toBeGreaterThan(0);
    expect(result.overlapRate).toBe(0);
  });

  it('closes an open ring automatically', () => {
    const polygon = toPolygon(SQUARE.slice(0, -1));
    const ring = polygon.geometry.coordinates[0];

    expect(ring[0]).toEqual(ring[ring.length - 1]);
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
