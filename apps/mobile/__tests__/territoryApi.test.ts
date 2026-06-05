jest.mock('@env', () => ({
  API_URL: 'http://localhost:3000',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  attackTerritory,
  getMyTerritories,
  updateTerritoryName,
} from '../src/api/territory';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('territory api', () => {
  it('posts attack payload to territory attack endpoint', async () => {
    const response = {
      success: true,
      overlapRate: 45,
      contestedAreaSqm: 120,
      damage: 18,
      occupationRateBefore: 100,
      occupationRateAfter: 82,
      acquiredAreaSqm: 21.6,
      neutralAreaSqm: 0,
      nextAttackAvailableAt: null,
      remainingDailyAttacks: 4,
      message: 'ok',
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const result = await attackTerritory(10, {
      runningLogId: 20,
      attackerCharacterId: 30,
    });

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/territories/10/attack');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          runningLogId: 20,
          attackerCharacterId: 30,
        }),
      }),
    );
    expect(result).toEqual(response);
  });

  it('throws error when server returns non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'bad request' }),
    });

    await expect(
      attackTerritory(10, {
        runningLogId: 20,
        attackerCharacterId: 30,
      }),
    ).rejects.toThrow('bad request');
  });

  it('fetches my territories', async () => {
    const response = [
      {
        id: 1,
        userId: 1,
        name: '홈 코스',
        coordinates: [],
        areaSqm: 1234,
        occupationRate: 90,
        lastActiveAt: '2026-06-01T00:00:00.000Z',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const result = await getMyTerritories();
    const [url] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toContain('/territories/me');
    expect(result).toEqual(response);
  });

  it('updates territory name', async () => {
    const response = { id: 1, name: '새 이름' };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const result = await updateTerritoryName(1, '새 이름');
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toContain('/territories/1/name');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: '새 이름' }),
      }),
    );
    expect(result).toEqual(response);
  });
});
