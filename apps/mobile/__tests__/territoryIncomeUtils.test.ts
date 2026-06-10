import {
  getEstimatedTerritoryHourlyIncome,
  getTerritoryBuffMultiplier,
} from '../src/utils/territoryIncomeUtils';

describe('territoryIncomeUtils', () => {
  it('calculates base hourly income without a buff character', () => {
    expect(getEstimatedTerritoryHourlyIncome(1200, 100, null)).toEqual({
      baseIncome: 1.2,
      multiplier: 1,
      rawIncome: 1.2,
      estimatedPoints: 1,
    });
  });

  it('applies buff character point efficiency to territory income', () => {
    expect(
      getEstimatedTerritoryHourlyIncome(2450, 100, {
        type: 'buff',
        pointLv: 1,
        basePointRate: 1.2,
      }),
    ).toEqual({
      baseIncome: 2.45,
      multiplier: 1.2,
      rawIncome: 2.94,
      estimatedPoints: 2,
    });
  });

  it('adds point efficiency bonus by point level', () => {
    expect(
      getTerritoryBuffMultiplier({
        type: 'buff',
        pointLv: 3,
        basePointRate: 1.2,
      }),
    ).toBe(1.3);
  });

  it('caps buff multiplier at 2x', () => {
    expect(
      getTerritoryBuffMultiplier({
        type: 'buff',
        pointLv: 30,
        basePointRate: 1.5,
      }),
    ).toBe(2);
  });

  it('uses safe defaults when buff income fields are missing', () => {
    const income = getEstimatedTerritoryHourlyIncome(2352, 75, {
      type: 'buff',
      pointLv: undefined as unknown as number,
      basePointRate: undefined as unknown as number,
    });

    expect(income.multiplier).toBe(1);
    expect(income.rawIncome).toBe(1.764);
    expect(income.estimatedPoints).toBe(1);
  });
});
