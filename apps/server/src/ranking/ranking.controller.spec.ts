import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
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
      providers: [
        { provide: RankingService, useValue: mockRankingService },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    }).compile();

    controller = module.get<RankingController>(RankingController);
    jest.clearAllMocks();
  });

  it('GET /ranking/area — 인증된 사용자 id를 넘겨 getAreaRanking에 위임한다', async () => {
    const expected = { rankings: [], myRank: null };
    mockRankingService.getAreaRanking.mockResolvedValue(expected);

    const result = await controller.getAreaRanking({ user: { id: 1 } });

    expect(mockRankingService.getAreaRanking).toHaveBeenCalledWith(1);
    expect(result).toBe(expected);
  });

  it('GET /ranking/area — 비인증 요청은 userId undefined로 위임한다', async () => {
    const expected = { rankings: [], myRank: null };
    mockRankingService.getAreaRanking.mockResolvedValue(expected);

    const result = await controller.getAreaRanking({ user: undefined });

    expect(mockRankingService.getAreaRanking).toHaveBeenCalledWith(undefined);
    expect(result).toBe(expected);
  });

  it('GET /ranking/distance — 인증된 사용자 id를 넘겨 getDistanceRanking에 위임한다', async () => {
    const expected = { rankings: [], myRank: null };
    mockRankingService.getDistanceRanking.mockResolvedValue(expected);

    const result = await controller.getDistanceRanking({ user: { id: 2 } });

    expect(mockRankingService.getDistanceRanking).toHaveBeenCalledWith(2);
    expect(result).toBe(expected);
  });

  it('GET /ranking/distance — 비인증 요청은 userId undefined로 위임한다', async () => {
    const expected = { rankings: [], myRank: null };
    mockRankingService.getDistanceRanking.mockResolvedValue(expected);

    const result = await controller.getDistanceRanking({ user: undefined });

    expect(mockRankingService.getDistanceRanking).toHaveBeenCalledWith(
      undefined,
    );
    expect(result).toBe(expected);
  });
});
