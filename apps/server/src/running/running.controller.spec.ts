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

  describe('finish', () => {
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
