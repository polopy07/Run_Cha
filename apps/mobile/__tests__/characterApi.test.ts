jest.mock('@env', () => ({
  API_URL: 'http://localhost:3000',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { dismantleCharacters } from '../src/api/character';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('character api', () => {
  it('posts dismantle payload to characters dismantle endpoint', async () => {
    const response = {
      dismantledCount: 2,
      earnedStatPoints: 5,
      statPoints: 12,
      remainingCharacterCount: 8,
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const result = await dismantleCharacters([10, 11]);

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/characters/dismantle');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userCharacterIds: [10, 11] }),
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

    await expect(dismantleCharacters([10])).rejects.toThrow('bad request');
  });
});
