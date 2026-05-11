import { Test, TestingModule } from '@nestjs/testing';
import { RunningController } from './running.controller';
import { RunningService } from './running.service';
import { FinishRunningDto } from './dto/finish-running.dto';

describe('RunningController', () => {
  let controller: RunningController;

  const mockService = {
    finish: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RunningController],
      providers: [{ provide: RunningService, useValue: mockService }],
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
      avg_pace: 5.0,
    };
    const mockReq = { user: { id: 42 } };

    it('서비스의 finish를 userId와 dto로 호출한다', async () => {
      const expected = { log: {}, territory: null, earned_points: 0, area_sqm: 0 };
      mockService.finish.mockResolvedValue(expected);

      const result = await controller.finish(mockReq, dto);

      expect(mockService.finish).toHaveBeenCalledWith(42, dto);
      expect(result).toEqual(expected);
    });

    it('req.user.id를 userId로 전달한다', async () => {
      mockService.finish.mockResolvedValue({});
      const reqWithDifferentId = { user: { id: 99 } };

      await controller.finish(reqWithDifferentId, dto);

      expect(mockService.finish).toHaveBeenCalledWith(99, dto);
    });
  });
});
