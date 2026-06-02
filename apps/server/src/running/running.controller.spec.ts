import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RunningController } from './running.controller';
import { RunningService } from './running.service';
import { FinishRunningDto } from './dto/finish-running.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

describe('RunningController', () => {
  let controller: RunningController;

  const mockService = {
    findMine: jest.fn(),
    finish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RunningController],
      providers: [
        { provide: RunningService, useValue: mockService },
        {
          provide: UsersService,
          useValue: {
            findOrCreateUser: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();
    controller = module.get<RunningController>(RunningController);
  });

  const dto: FinishRunningDto = {
    path: [
      { lat: 37.5, lng: 127.0 },
      { lat: 37.501, lng: 127.0 },
      { lat: 37.501, lng: 127.001 },
    ],
    distance_km: 1.5,
    started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  };
  const mockUser = { id: 42 };

  describe('findMine', () => {
    it('calls service with current user id', async () => {
      const expected = [
        {
          id: 1,
          distanceKm: 1.2,
          earnedPoints: 120,
          avgPace: 5,
          areaSqm: 0,
          startedAt: new Date('2026-05-27T10:00:00.000Z'),
          endedAt: new Date('2026-05-27T10:10:00.000Z'),
        },
      ];
      mockService.findMine.mockResolvedValue(expected);

      const result = await controller.findMine(mockUser as User);

      expect(mockService.findMine).toHaveBeenCalledWith(42);
      expect(result).toEqual(expected);
    });
  });

  describe('finish', () => {
    it('서비스의 finish를 userId와 dto로 호출한다', async () => {
      const expected = {
        runningLogId: 1,
        territoryId: null,
        areaSqm: 0,
        earnedPoints: 0,
      };
      mockService.finish.mockResolvedValue(expected);

      const result = await controller.finish(mockUser as User, dto);

      expect(mockService.finish).toHaveBeenCalledWith(42, dto);
      expect(result).toEqual(expected);
    });

    it('req.user.id를 userId로 전달한다', async () => {
      mockService.finish.mockResolvedValue({});
      const differentUser = { id: 99 };

      await controller.finish(differentUser as User, dto);

      expect(mockService.finish).toHaveBeenCalledWith(99, dto);
    });
  });
});
