import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveToken, getToken, removeToken, apiFetch } from '../src/api/client';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.clear as jest.Mock)();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('token helpers', () => {
  it('saveToken → getToken 으로 저장/조회', async () => {
    await saveToken('tok-123');
    const result = await getToken();
    expect(result).toBe('tok-123');
  });

  it('removeToken 후 getToken은 null', async () => {
    await saveToken('tok-123');
    await removeToken();
    const result = await getToken();
    expect(result).toBeNull();
  });
});

describe('apiFetch', () => {
  it('200 응답 시 JSON 반환', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: 'test' }),
    });

    const data = await apiFetch<{ id: number; name: string }>('/test');
    expect(data).toEqual({ id: 1, name: 'test' });
  });

  it('저장된 토큰이 있으면 Authorization 헤더 포함', async () => {
    await saveToken('my-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiFetch('/test');

    const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBe('Bearer my-token');
  });

  it('토큰 없으면 Authorization 헤더 미포함', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await apiFetch('/test');

    const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(callHeaders.Authorization).toBeUndefined();
  });

  it('에러 응답(JSON) 시 서버 메시지로 throw', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    await expect(apiFetch('/secret')).rejects.toThrow('Unauthorized');
  });

  it('에러 응답(비-JSON) 시 기본 메시지로 throw', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(apiFetch('/crash')).rejects.toThrow('Request failed: /crash');
  });
});
