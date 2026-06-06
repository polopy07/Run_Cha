import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TerritoryIncomeService } from './territory-income.service';

const INCOME_PARAMS = [1000, 0.05, 2];

describe('TerritoryIncomeService', () => {
  let service: TerritoryIncomeService;

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoryIncomeService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TerritoryIncomeService>(TerritoryIncomeService);
  });

  it('updates user points with a single aggregate UPDATE JOIN query', async () => {
    mockDataSource.query.mockResolvedValue({ affectedRows: 2, changedRows: 2 });

    const result = await service.handleHourlyIncome();

    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users u'),
      INCOME_PARAMS,
    );
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN'),
      INCOME_PARAMS,
    );
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('t.area_sqm * t.occupation_rate / 100 / ?'),
      INCOME_PARAMS,
    );
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining("WHEN c.type = 'buff'"),
      INCOME_PARAMS,
    );
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(c.base_point_rate, 1)'),
      INCOME_PARAMS,
    );
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SET u.points = u.points + income.points'),
      INCOME_PARAMS,
    );
    expect(result).toEqual({ affectedRows: 2, changedRows: 2 });
  });

  it('returns zero counts when there are no recipients', async () => {
    mockDataSource.query.mockResolvedValue({ affectedRows: 0, changedRows: 0 });

    const result = await service.handleHourlyIncome();

    expect(result).toEqual({ affectedRows: 0, changedRows: 0 });
  });
});
