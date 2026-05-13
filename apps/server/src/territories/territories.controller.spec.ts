import { Test, TestingModule } from '@nestjs/testing';
import { TerritoriesController } from './territories.controller';
import { TerritoriesService } from './territories.service';
import { GetTerritoriesDto } from './dto/get-territories.dto';

describe('TerritoriesController', () => {
  let controller: TerritoriesController;

  const mockService = {
    findInBounds: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TerritoriesController],
      providers: [{ provide: TerritoriesService, useValue: mockService }],
    }).compile();
    controller = module.get<TerritoriesController>(TerritoriesController);
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
});
