import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RunningService } from './running.service';
import { RunningLog } from './entities/running-log.entity';
import { User } from '../users/entities/user.entity';
import { TerritoriesService } from '../territories/territories.service';

// 서울 기준 약 110m × 90m 정사각형 폐곡선 (시작점 == 끝점 → 거리 0m)
const CLOSED_LOOP = [
  { lat: 37.5, lng: 127.0 },
  { lat: 37.501, lng: 127.0 },
  { lat: 37.501, lng: 127.001 },
  { lat: 37.5, lng: 127.001 },
  { lat: 37.5, lng: 127.0 }, // 시작점과 동일 → isClosedLoop = true
];

// 시작점과 끝점이 1km 이상 떨어진 열린 경로
const OPEN_PATH = [
  { lat: 37.5, lng: 127.0 },
  { lat: 37.51, lng: 127.0 },
  { lat: 37.51, lng: 127.01 },
];

describe('RunningService', () => {
  let service: RunningService;

  const mockRunningLogRepo = {
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: 1, ...data }),
    ),
  };
  const mockUserRepo = {
    increment: jest.fn().mockResolvedValue(undefined),
  };
  const mockTerritoriesService = {
    registerTerritory: jest.fn().mockResolvedValue({ id: 1, user_id: 1 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunningService,
        {
          provide: getRepositoryToken(RunningLog),
          useValue: mockRunningLogRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: TerritoriesService, useValue: mockTerritoriesService },
      ],
    }).compile();
    service = module.get<RunningService>(RunningService);
  });

  describe('finish', () => {
    describe('영토 등록 조건', () => {
      it('폐곡선 경로 → 영토를 등록한다', async () => {
        const result = await service.finish(1, {
          path: CLOSED_LOOP,
          distance_km: 1.0,
          avg_pace: 4.5,
        });

        expect(result.territory).not.toBeNull();
        expect(mockTerritoriesService.registerTerritory).toHaveBeenCalledWith(
          1,
          CLOSED_LOOP,
          expect.any(Number),
        );
      });

      it('열린 경로 → 영토를 등록하지 않는다', async () => {
        const result = await service.finish(1, {
          path: OPEN_PATH,
          distance_km: 2.0,
          avg_pace: 5.0,
        });

        expect(result.territory).toBeNull();
        expect(mockTerritoriesService.registerTerritory).not.toHaveBeenCalled();
      });

      it('좌표가 2개 이하 → 영토 없음, areaSqm = 0', async () => {
        const result = await service.finish(1, {
          path: [
            { lat: 37.5, lng: 127.0 },
            { lat: 37.501, lng: 127.0 },
          ],
          distance_km: 0.1,
          avg_pace: 5.0,
        });

        expect(result.territory).toBeNull();
        expect(result.area_sqm).toBe(0);
      });
    });

    describe('페이스 배율 (earnedPoints = floor(area / 100 * multiplier))', () => {
      it.each([
        [3.5, 1.2], // 3~4분/km: fast_run
        [4.5, 1.0], // 4~5분/km: run
        [6.0, 0.8], // 5~7분/km: jog
        [7.5, 0.6], // 7~8분/km: fast_walk
      ])(
        '유효 페이스 avgPace=%f → multiplier=%f 적용',
        async (pace: number, multiplier: number) => {
          const result = await service.finish(1, {
            path: CLOSED_LOOP,
            distance_km: 1.0,
            avg_pace: pace,
          });

          const expected = Math.floor((result.area_sqm / 100) * multiplier);
          expect(result.earned_points).toBe(expected);
        },
      );

      it.each([
        [2.5], // < 3분/km
        [9.0], // > 8분/km
      ])(
        '무효 페이스 avgPace=%f → earned_points = 0, 영토는 등록됨 (포인트만 무효)',
        async (pace: number) => {
          const result = await service.finish(1, {
            path: CLOSED_LOOP,
            distance_km: 1.0,
            avg_pace: pace,
          });

          expect(result.earned_points).toBe(0);
          // 기획서 p.6: "포인트 무효"만 명시, 영토 등록은 막지 않음
          expect(result.territory).not.toBeNull();
        },
      );
    });

    describe('RunningLog 저장', () => {
      it('올바른 필드로 로그를 생성한다', async () => {
        await service.finish(1, {
          path: OPEN_PATH,
          distance_km: 2.5,
          avg_pace: 5.0,
        });

        expect(mockRunningLogRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 1,
            path: OPEN_PATH,
            distance_km: 2.5,
            avg_pace: 5.0,
            ended_at: expect.any(Date) as unknown,
          }),
        );
      });

      it('생성 후 save를 호출한다', async () => {
        await service.finish(1, {
          path: OPEN_PATH,
          distance_km: 1.0,
          avg_pace: 5.0,
        });

        expect(mockRunningLogRepo.save).toHaveBeenCalledTimes(1);
      });
    });

    describe('반환값 구조', () => {
      it('runningLogId, territoryId, areaSqm, earnedPoints를 반환한다', async () => {
        const result = await service.finish(1, {
          path: OPEN_PATH,
          distance_km: 1.0,
          avg_pace: 5.0,
        });

        expect(result).toEqual(
          expect.objectContaining({
            log: expect.any(Object) as unknown,
            territory: null,
            earned_points: expect.any(Number) as unknown,
            area_sqm: expect.any(Number) as unknown,
          }),
        );
      });
    });
  });
});
