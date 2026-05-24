import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TerritoryIncomeService } from './territory-income.service';
import { User } from '../users/entities/user.entity';

describe('TerritoryIncomeService', () => {
  let service: TerritoryIncomeService;

  const mockManager = {
    increment: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation(async (callback) =>
      callback(mockManager),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoryIncomeService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TerritoryIncomeService>(TerritoryIncomeService);
  });

  it('queries hourly income from effective occupied area per user', async () => {
    mockDataSource.query.mockResolvedValue([]);

    await service.handleHourlyIncome();

    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SUM(area_sqm * occupation_rate / 100)'),
      [1000],
    );
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('HAVING points > 0'),
      [1000],
    );
  });

  it('does not update points when there are no recipients', async () => {
    mockDataSource.query.mockResolvedValue([]);

    const result = await service.handleHourlyIncome();

    expect(mockDataSource.transaction).not.toHaveBeenCalled();
    expect(mockManager.increment).not.toHaveBeenCalled();
    expect(result).toEqual({ recipients: 0, totalPoints: 0 });
  });

  it('increments user points for each income row', async () => {
    mockDataSource.query.mockResolvedValue([
      { userId: 1, points: 3 },
      { userId: '2', points: '5' },
    ]);

    const result = await service.handleHourlyIncome();

    expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(mockManager.increment).toHaveBeenCalledWith(
      User,
      { id: 1 },
      'points',
      3,
    );
    expect(mockManager.increment).toHaveBeenCalledWith(
      User,
      { id: 2 },
      'points',
      5,
    );
    expect(result).toEqual({ recipients: 2, totalPoints: 8 });
  });
});
