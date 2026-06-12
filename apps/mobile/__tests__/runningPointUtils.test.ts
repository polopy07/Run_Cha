import { estimateRunningPoints } from '../src/utils/runningPointUtils';

describe('estimateRunningPoints', () => {
  it('거리 또는 시간이 없으면 0 반환', () => {
    expect(estimateRunningPoints(0, 600)).toBe(0);
    expect(estimateRunningPoints(100, 0)).toBe(0);
    expect(estimateRunningPoints(9, 600)).toBe(0); // 10m 미만
  });

  it('속도가 유효 범위(4~20km/h) 밖이면 0 반환', () => {
    // 1km를 3600초(1시간) = 1km/h → 속도 미달
    expect(estimateRunningPoints(1000, 3600)).toBe(0);
    // 1km를 60초 = 60km/h → 속도 초과
    expect(estimateRunningPoints(1000, 60)).toBe(0);
  });

  it('run 페이스(≤5min/km) 에서 올바른 포인트 계산', () => {
    // 1km, 5분(300초) = 페이스 5.0 min/km → paceMultiplier 1.0
    // distanceMultiplier = min(1.1^1, 3.0) ≈ 1.1
    // floor(1 * 100 * 1.0 * 1.1) = 110
    expect(estimateRunningPoints(1000, 300)).toBe(110);
  });

  it('fast_run 페이스(≤4min/km) 에서 올바른 포인트 계산', () => {
    // 1km, 4분(240초) = 페이스 4.0 min/km → paceMultiplier 1.2
    // floor(1 * 100 * 1.2 * 1.1) = 132
    expect(estimateRunningPoints(1000, 240)).toBe(132);
  });

  it('jog 페이스(≤7min/km) 에서 올바른 포인트 계산', () => {
    // 1km, 7분(420초) = 페이스 7.0 min/km → paceMultiplier 0.8
    // floor(1 * 100 * 0.8 * 1.1) = 88
    expect(estimateRunningPoints(1000, 420)).toBe(88);
  });

  it('fast_walk 페이스(≤8min/km) 에서 올바른 포인트 계산', () => {
    // 1km, 8분(480초) = 페이스 8.0 min/km → paceMultiplier 0.6
    // floor(1 * 100 * 0.6 * 1.1) = 66
    expect(estimateRunningPoints(1000, 480)).toBe(66);
  });

  it('거리가 길수록 distanceMultiplier 증가 (최대 3배)', () => {
    const short = estimateRunningPoints(1000, 300);   // 1km
    const medium = estimateRunningPoints(3000, 900);  // 3km
    expect(medium).toBeGreaterThan(short * 3);        // 배율 효과
  });

  it('distanceMultiplier 상한 3.0 적용', () => {
    // 30km, run 페이스 = floor(30 * 100 * 1.0 * 3.0) = 9000
    // 1.1^30 ≈ 17.4 이므로 cap 3.0 적용
    expect(estimateRunningPoints(30000, 9000)).toBe(9000);
  });
});
