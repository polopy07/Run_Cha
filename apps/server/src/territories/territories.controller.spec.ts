import { Test, TestingModule } from '@nestjs/testing';
import { TerritoriesController } from './territories.controller';
import { TerritoriesService } from './territories.service';
import { GetTerritoriesDto } from './dto/get-territories.dto';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('TerritoriesController', () => {
  let controller: TerritoriesController;

  const mockService = {
    findMine: jest.fn(),
    findInBounds: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TerritoriesController],
      providers: [{ provide: TerritoriesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<TerritoriesController>(TerritoriesController);
  });

  describe('findMine', () => {
    it('calls findMine with the current user id', async () => {
      const user = { id: 1 } as User;
      const expected = [{ id: 7 }];
      mockService.findMine.mockResolvedValue(expected);

      const result = await controller.findMine(user);

      expect(mockService.findMine).toHaveBeenCalledWith(1);
      expect(result).toEqual(expected);
    });
  });

  describe('getInBounds', () => {
    it('서비스의 findInBounds를 DTO와 함께 호출한다', async () => {
      const dto: GetTerritoriesDto = {
        minLat: 37.0,
        maxLat: 38.0,
        minLng: 126.0,
        maxLng: 128.0,
      };
      const expected = [{ id: 1 }];
      mockService.findInBounds.mockResolvedValue(expected);

      const result = await controller.getInBounds(dto);

      expect(mockService.findInBounds).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('서비스가 빈 배열을 반환하면 그대로 반환한다', async () => {
      mockService.findInBounds.mockResolvedValue([]);

      const result = await controller.getInBounds({} as GetTerritoriesDto);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('calls findOne with the territory id and current user id', async () => {
      const user = { id: 1 } as User;
      const expected = { id: 7, isMine: true };
      mockService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(user, 7);

      expect(mockService.findOne).toHaveBeenCalledWith(7, 1);
      expect(result).toEqual(expected);
    });
  });
});
