jest.mock('@env', () => ({
  API_URL: 'http://localhost:3000',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { attackTerritory } from '../src/api/territory';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
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
});
