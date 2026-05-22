import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as turf from '@turf/turf';
import { RunningService } from './running.service';
import { RunningLog } from './entities/running-log.entity';
import { Territory } from '../territories/entities/territory.entity';

const CLOSED_LOOP = [
  { lat: 37.5, lng: 127.0 },
  { lat: 37.501, lng: 127.0 },
  { lat: 37.501, lng: 127.001 },
  { lat: 37.5, lng: 127.001 },
  { lat: 37.5, lng: 127.0 },
];

const OPEN_PATH = [
  { lat: 37.5, lng: 127.0 },
  { lat: 37.51, lng: 127.0 },
  { lat: 37.51, lng: 127.01 },
];

function calculateDistanceKm(path: { lat: number; lng: number }[]) {
  return turf.length(
    turf.lineString(path.map((point) => [point.lng, point.lat])),
    { units: 'kilometers' },
  );
}

function createFinishDto(
  path: { lat: number; lng: number }[],
  avgPaceMinutesPerKm = 5,
) {
  const distanceKm = calculateDistanceKm(path);
  const startedAt = new Date(
    Date.now() - distanceKm * avgPaceMinutesPerKm * 60 * 1000,
  );

  return {
    path,
    distance_km: distanceKm,
    started_at: startedAt.toISOString(),
  };
}

describe('RunningService', () => {
  let service: RunningService;

  const mockUserQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockEntityManager = {
    create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: 1, ...data }),
    ),
    createQueryBuilder: jest.fn(() => mockUserQb),
  };

  const mockDataSource = {
    transaction: jest.fn(
      async (cb: (em: typeof mockEntityManager) => Promise<unknown>) =>
        cb(mockEntityManager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunningService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get<RunningService>(RunningService);
  });

  describe('finish', () => {
    describe('영토 등록 조건', () => {
      it('폐곡선 경로면 영토를 등록한다', async () => {
        const result = await service.finish(1, createFinishDto(CLOSED_LOOP));

        expect(result.territory).not.toBeNull();
        expect(mockEntityManager.create).toHaveBeenCalledWith(
          Territory,
          expect.objectContaining({
            user_id: 1,
            coordinates: CLOSED_LOOP,
            area_sqm: expect.any(Number) as unknown,
            occupation_rate: 100,
            center_lat: expect.any(Number) as unknown,
            center_lng: expect.any(Number) as unknown,
          }),
        );
      });

      it('열린 경로면 영토를 등록하지 않는다', async () => {
        const result = await service.finish(1, createFinishDto(OPEN_PATH));

        expect(result.territory).toBeNull();
        expect(mockEntityManager.create).not.toHaveBeenCalledWith(
          Territory,
          expect.any(Object),
        );
      });

      it('좌표가 2개 이하면 영토가 없고 area_sqm은 0이다', async () => {
        const result = await service.finish(
          1,
          createFinishDto([
            { lat: 37.5, lng: 127.0 },
            { lat: 37.501, lng: 127.0 },
          ]),
        );

        expect(result.territory).toBeNull();
        expect(result.area_sqm).toBe(0);
      });
    });

    describe('서버 계산 페이스 배율', () => {
      it.each([
        [3.5, 1.2],
        [4.5, 1.0],
        [6.0, 0.8],
        [7.5, 0.6],
      ])(
        '서버 계산 평균 페이스가 %f분/km이면 multiplier %f를 적용한다',
        async (pace: number, multiplier: number) => {
          const result = await service.finish(
            1,
            createFinishDto(CLOSED_LOOP, pace),
          );

          const distKm = calculateDistanceKm(CLOSED_LOOP);
          const distMultiplier = Math.min(Math.pow(1.1, distKm), 3.0);
          const expected = Math.floor(
            distKm * 100 * multiplier * distMultiplier,
          );
          expect(result.earned_points).toBe(expected);
        },
      );

      it.each([[2.5], [16.0]])(
        '유효 속도 범위 밖이면 포인트를 지급하지 않는다',
        async (pace: number) => {
          const result = await service.finish(
            1,
            createFinishDto(CLOSED_LOOP, pace),
          );

          expect(result.earned_points).toBe(0);
          expect(result.territory).not.toBeNull();
        },
      );
    });

    describe('RunningLog 저장', () => {
      it('서버에서 계산한 거리, 페이스, 시작/종료 시각으로 로그를 생성한다', async () => {
        const dto = createFinishDto(OPEN_PATH, 5);

        await service.finish(1, dto);

        expect(mockEntityManager.create).toHaveBeenCalledWith(
          RunningLog,
          expect.objectContaining({
            user_id: 1,
            path: OPEN_PATH,
            distance_km: expect.any(Number) as unknown,
            avg_pace: expect.any(Number) as unknown,
            started_at: expect.any(Date) as unknown,
            ended_at: expect.any(Date) as unknown,
          }),
        );
      });

      it('생성 후 save를 호출한다', async () => {
        await service.finish(1, createFinishDto(OPEN_PATH));

        expect(mockEntityManager.save).toHaveBeenCalledTimes(1);
        expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      });

      it('포인트 증가와 영토 생성을 같은 트랜잭션에서 처리한다', async () => {
        await service.finish(1, createFinishDto(CLOSED_LOOP));

        expect(mockEntityManager.createQueryBuilder).toHaveBeenCalled();
        expect(mockUserQb.execute).toHaveBeenCalled();
        expect(mockEntityManager.save).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 1,
            coordinates: CLOSED_LOOP,
          }),
        );
      });

      it('시작 시간이 종료 시간 이후면 예외를 던진다', async () => {
        await expect(
          service.finish(1, {
            path: OPEN_PATH,
            distance_km: 1,
            started_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe('반환값 구조', () => {
      it('log, territory, earned_points, area_sqm을 반환한다', async () => {
        const result = await service.finish(1, createFinishDto(OPEN_PATH));

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
