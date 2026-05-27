import { finishRunning, getRunningLogs } from '../src/api/running';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe('running api', () => {
  it('requests current user running log summaries', async () => {
    const expected = [
      {
        id: 1,
        distanceKm: 1.2,
        earnedPoints: 120,
        avgPace: 5,
        areaSqm: 0,
        startedAt: '2026-05-27T10:00:00.000Z',
        endedAt: '2026-05-27T10:10:00.000Z',
      },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(expected),
    });

    const result = await getRunningLogs();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/running/logs'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual(expected);
  });

  it('sends finish running payload with server coordinate shape', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          log: {},
          territory: null,
          earned_points: 10,
          area_sqm: 0,
        }),
    });

    await finishRunning({
      path: [
        { latitude: 35.1, longitude: 128.9 },
        { latitude: 35.2, longitude: 129 },
      ],
      distance_km: 1,
      started_at: '2026-05-27T10:00:00.000Z',
    });

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(
      JSON.stringify({
        path: [
          { lat: 35.1, lng: 128.9 },
          { lat: 35.2, lng: 129 },
        ],
        distance_km: 1,
        started_at: '2026-05-27T10:00:00.000Z',
      }),
    );
  });
});
