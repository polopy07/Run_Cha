import { Test, TestingModule } from '@nestjs/testing';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';

const mockRankingService = {
  getAreaRanking: jest.fn(),
  getDistanceRanking: jest.fn(),
};

describe('RankingController', () => {
  let controller: RankingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RankingController],
      providers: [{ provide: RankingService, useValue: mockRankingService }],
    }).compile();

    controller = module.get<RankingController>(RankingController);
    jest.clearAllMocks();
  });

  it('GET /ranking/area — RankingService.getAreaRanking에 위임한다', async () => {
    const expected = [
      { rank: 1, userId: 1, nickname: 'alice', totalAreaSqm: 5000 },
    ];
    mockRankingService.getAreaRanking.mockResolvedValue(expected);

    const result = await controller.getAreaRanking();

    expect(mockRankingService.getAreaRanking).toHaveBeenCalledTimes(1);
    expect(result).toBe(expected);
  });

  it('GET /ranking/distance — RankingService.getDistanceRanking에 위임한다', async () => {
    const expected = [
      { rank: 1, userId: 2, nickname: 'bob', totalDistanceKm: 300 },
    ];
    mockRankingService.getDistanceRanking.mockResolvedValue(expected);

    const result = await controller.getDistanceRanking();

    expect(mockRankingService.getDistanceRanking).toHaveBeenCalledTimes(1);
    expect(result).toBe(expected);
  });
});
