import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AttacksService, getKstDayRange } from './attacks.service';
import { AttackLog } from './entities/attack-log.entity';
import { AttackResult } from './enums/attack-result.enum';
import { CharacterType } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { RunningLog } from '../running/entities/running-log.entity';
import { Territory } from '../territories/entities/territory.entity';
import { EventsGateway } from '../socket/events.gateway';

const SQUARE = [
  { lat: 37.0, lng: 127.0 },
  { lat: 37.0, lng: 127.001 },
  { lat: 37.001, lng: 127.001 },
  { lat: 37.001, lng: 127.0 },
  { lat: 37.0, lng: 127.0 },
];

const HALF_SQUARE = [
  { lat: 37.0, lng: 127.0 },
  { lat: 37.0, lng: 127.0005 },
  { lat: 37.001, lng: 127.0005 },
  { lat: 37.001, lng: 127.0 },
  { lat: 37.0, lng: 127.0 },
];

function makeRepository() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
}

type MockRepository = ReturnType<typeof makeRepository>;
type MockTransactionManager = {
  getRepository: (entity: unknown) => MockRepository;
  query: jest.Mock;
};
type SavedTerritoryCall = [
  {
    id?: number;
    user_id?: number;
    coordinates?: unknown[];
    area_sqm?: number;
    occupation_rate?: number;
    center_lat?: number;
    center_lng?: number;
  },
];
type FindOneCall = [
  {
    lock?: { mode?: string };
    where?: { user_id?: number };
  },
];

function getSavedTerritory(
  repo: MockRepository,
  callIndex: number,
): SavedTerritoryCall[0] {
  const calls = repo.save.mock.calls as unknown;
  const savedTerritory = (calls as SavedTerritoryCall[])[callIndex]?.[0];

  if (!savedTerritory) {
    throw new Error(`Missing saved territory call at index ${callIndex}.`);
  }

  return savedTerritory;
}

function expectLockedAttackerTerritoryFind(repo: MockRepository) {
  const calls = repo.findOne.mock.calls as unknown;
  const hasLockedAttackerFind = (calls as FindOneCall[]).some(([options]) => {
    return (
      options?.lock?.mode === 'pessimistic_write' &&
      options?.where?.user_id === 1
    );
  });

  expect(hasLockedAttackerFind).toBe(true);
}

describe('AttacksService', () => {
  let service: AttacksService;
  let territoryRepo: MockRepository;
  let runningLogRepo: MockRepository;
  let userCharacterRepo: MockRepository;
  let attackLogRepo: MockRepository;
  let transactionTerritoryRepo: MockRepository;
  let transactionAttackLogRepo: MockRepository;
  let managerQuery: jest.Mock;

  const dataSource = {
    transaction: jest.fn(),
  };

  const territory = {
    id: 10,
    user_id: 2,
    coordinates: SQUARE,
    area_sqm: 12364,
    occupation_rate: 100,
  } as Territory;

  const attackerOwnedTerritory = {
    id: 11,
    user_id: 1,
    coordinates: HALF_SQUARE,
    area_sqm: 6182,
    occupation_rate: 100,
    center_lat: 37.0005,
    center_lng: 127.00025,
  } as Territory;

  const runningLog = {
    id: 20,
    user_id: 1,
    path: SQUARE,
  } as RunningLog;

  const attackerCharacter = {
    id: 30,
    user_id: 1,
    attack_lv: 2,
    character: {
      type: CharacterType.ATTACK,
      base_attack: 20,
    },
  } as UserCharacter;

  const defenderCharacter = {
    id: 40,
    user_id: 2,
    defense_lv: 2,
    deployed_territory_id: 10,
    character: {
      type: CharacterType.DEFENSE,
      base_defense: 10,
    },
  } as UserCharacter;

  beforeEach(async () => {
    territoryRepo = makeRepository();
    runningLogRepo = makeRepository();
    userCharacterRepo = makeRepository();
    attackLogRepo = makeRepository();
    transactionTerritoryRepo = makeRepository();
    transactionAttackLogRepo = makeRepository();
    managerQuery = jest.fn().mockResolvedValue([{ acquired: 1 }]);

    territoryRepo.findOne.mockImplementation(
      (options?: { where?: Record<string, unknown> }) => {
        if (options?.where && 'id' in options.where) {
          return Promise.resolve({ ...territory });
        }
        if (options?.where && 'user_id' in options.where) {
          return Promise.resolve({ ...attackerOwnedTerritory });
        }

        return Promise.resolve(null);
      },
    );
    runningLogRepo.findOne.mockResolvedValue(runningLog);
    userCharacterRepo.findOne.mockResolvedValue(attackerCharacter);
    userCharacterRepo.find.mockResolvedValue([]);
    transactionAttackLogRepo.count.mockResolvedValue(0);
    transactionTerritoryRepo.findOne.mockResolvedValue({
      ...attackerOwnedTerritory,
    });
    dataSource.transaction.mockImplementation(
      (callback: (manager: MockTransactionManager) => void) =>
        callback({
          getRepository: (entity: unknown) =>
            entity === Territory
              ? transactionTerritoryRepo
              : transactionAttackLogRepo,
          query: managerQuery,
        }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttacksService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(Territory), useValue: territoryRepo },
        { provide: getRepositoryToken(RunningLog), useValue: runningLogRepo },
        {
          provide: getRepositoryToken(UserCharacter),
          useValue: userCharacterRepo,
        },
        { provide: getRepositoryToken(AttackLog), useValue: attackLogRepo },
        {
          provide: EventsGateway,
          useValue: {
            broadcastRankingUpdate: jest.fn(),
            broadcastTerritoryUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AttacksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates occupation rate and saves attack log on success', async () => {
    const result = await service.attack(1, 10, {
      runningLogId: 20,
      attackerCharacterId: 30,
    });

    expect(result.success).toBe(true);
    expect(result.damage).toBe(25);
    expect(result.occupationRateBefore).toBe(100);
    expect(result.occupationRateAfter).toBe(75);
    expect(result.acquiredAreaSqm).toBeGreaterThan(9000);
    expect(result.neutralAreaSqm).toBe(0);
    expect(result.remainingDailyAttacks).toBe(4);
    expect(result.nextAttackAvailableAt).toBeNull();
    expect(result.message).toBe('침략에 성공했습니다.');
    expect(transactionTerritoryRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ area_sqm: 0, occupation_rate: 0 }),
    );
    const mergedAttackerTerritory = getSavedTerritory(
      transactionTerritoryRepo,
      1,
    );
    expect(mergedAttackerTerritory).toEqual(
      expect.objectContaining({
        id: 11,
        user_id: 1,
        occupation_rate: 100,
      }),
    );
    expect(typeof mergedAttackerTerritory.area_sqm).toBe('number');
    expect(transactionTerritoryRepo.create).not.toHaveBeenCalled();
    expect(transactionAttackLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        attacker_id: 1,
        defender_id: 2,
        territory_id: 10,
        running_log_id: 20,
        attacker_character_id: 30,
        defender_character_id: null,
        result: AttackResult.ATTACKER_WIN,
        occupation_rate_before: 100,
        occupation_rate_after: 75,
      }),
    );
    expect(transactionAttackLogRepo.save).toHaveBeenCalled();
    expect(managerQuery).toHaveBeenCalledWith(
      'SELECT GET_LOCK(?, 5) AS acquired',
      expect.any(Array),
    );
    expect(managerQuery).toHaveBeenCalledWith(
      'SELECT RELEASE_LOCK(?)',
      expect.any(Array),
    );
    expectLockedAttackerTerritoryFind(transactionTerritoryRepo);
  });

  it('moves the overlapped polygon to attacker territory on partial success', async () => {
    runningLogRepo.findOne.mockResolvedValue({
      ...runningLog,
      path: HALF_SQUARE,
    });

    const result = await service.attack(1, 10, {
      runningLogId: 20,
      attackerCharacterId: 30,
    });

    expect(result.success).toBe(true);
    expect(result.overlapRate).toBeGreaterThan(39);
    expect(result.overlapRate).toBeLessThan(41);
    expect(result.acquiredAreaSqm).toBeGreaterThan(4800);
    expect(result.acquiredAreaSqm).toBeLessThan(5100);
    const defenderTerritory = getSavedTerritory(transactionTerritoryRepo, 0);
    expect(defenderTerritory).toEqual(
      expect.objectContaining({
        user_id: 2,
        occupation_rate: 75,
      }),
    );
    expect(typeof defenderTerritory.area_sqm).toBe('number');
    expect(Array.isArray(defenderTerritory.coordinates)).toBe(true);
    expect(typeof defenderTerritory.center_lat).toBe('number');
    expect(typeof defenderTerritory.center_lng).toBe('number');

    const mergedAttackerTerritory = getSavedTerritory(
      transactionTerritoryRepo,
      1,
    );
    expect(mergedAttackerTerritory).toEqual(
      expect.objectContaining({
        id: 11,
        user_id: 1,
        occupation_rate: 100,
      }),
    );
    expect(Array.isArray(mergedAttackerTerritory.coordinates)).toBe(true);
    expect(typeof mergedAttackerTerritory.area_sqm).toBe('number');
    expect(typeof mergedAttackerTerritory.center_lat).toBe('number');
    expect(typeof mergedAttackerTerritory.center_lng).toBe('number');
  });

  it('rejects successful transfer when attacker territory is missing', async () => {
    territoryRepo.findOne
      .mockResolvedValueOnce({ ...territory })
      .mockResolvedValueOnce(null);

    await expect(
      service.attack(1, 10, {
        runningLogId: 20,
        attackerCharacterId: 30,
      }),
    ).rejects.toThrow('침략하려면 먼저 자신의 영토가 있어야 합니다.');

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(transactionTerritoryRepo.create).not.toHaveBeenCalled();
    expect(transactionAttackLogRepo.create).not.toHaveBeenCalled();
  });

  it('rejects when attacker territory disappears before locked transfer', async () => {
    transactionTerritoryRepo.findOne.mockResolvedValue(null);

    await expect(
      service.attack(1, 10, {
        runningLogId: 20,
        attackerCharacterId: 30,
      }),
    ).rejects.toThrow('침략하려면 먼저 자신의 영토가 있어야 합니다.');

    expect(dataSource.transaction).toHaveBeenCalled();
    expectLockedAttackerTerritoryFind(transactionTerritoryRepo);
    expect(transactionAttackLogRepo.create).not.toHaveBeenCalled();
  });

  it('saves deployed defender character id when defender is deployed', async () => {
    userCharacterRepo.find.mockResolvedValue([defenderCharacter]);

    await service.attack(1, 10, {
      runningLogId: 20,
      attackerCharacterId: 30,
    });

    expect(transactionAttackLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        defender_character_id: 40,
        result: AttackResult.ATTACKER_WIN,
        occupation_rate_before: 100,
        occupation_rate_after: 90,
      }),
    );
  });

  it('saves defender_win log when defense prevents occupation rate reduction', async () => {
    userCharacterRepo.find.mockResolvedValue([
      {
        ...defenderCharacter,
        defense_lv: 10,
        character: {
          type: CharacterType.DEFENSE,
          base_defense: 100,
        },
      },
    ]);

    const result = await service.attack(1, 10, {
      runningLogId: 20,
      attackerCharacterId: 30,
    });

    expect(result.success).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.occupationRateAfter).toBe(100);
    expect(result.acquiredAreaSqm).toBe(0);
    expect(result.message).toBe('방어력이 높아 점령률이 감소하지 않았습니다.');
    expect(transactionAttackLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        defender_character_id: 40,
        result: AttackResult.DEFENDER_WIN,
        occupation_rate_before: 100,
        occupation_rate_after: 100,
      }),
    );
  });

  it('rejects attacking own territory', async () => {
    territoryRepo.findOne.mockResolvedValue({ ...territory, user_id: 1 });

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('자신의 영토는 침략할 수 없습니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when daily attack limit is reached', async () => {
    transactionAttackLogRepo.count.mockResolvedValueOnce(5);

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('오늘의 침략 가능 횟수를 모두 사용했습니다.');
    expect(transactionTerritoryRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when running log was already used for attack', async () => {
    transactionAttackLogRepo.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('이미 침략에 사용한 러닝 기록입니다.');
    expect(transactionTerritoryRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when daily attack lock cannot be acquired', async () => {
    managerQuery.mockResolvedValueOnce([{ acquired: 0 }]);

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow(
      '침략 요청을 처리하는 중입니다. 잠시 후 다시 시도해주세요.',
    );
    expect(transactionTerritoryRepo.save).not.toHaveBeenCalled();
  });

  it('rejects non-attack character', async () => {
    userCharacterRepo.findOne.mockResolvedValue({
      ...attackerCharacter,
      character: { type: CharacterType.DEFENSE, base_attack: 20 },
    });

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('공격형 캐릭터만 침략에 사용할 수 있습니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects insufficient running overlap', async () => {
    runningLogRepo.findOne.mockResolvedValue({
      ...runningLog,
      path: [
        { lat: 37.01, lng: 127.01 },
        { lat: 37.01, lng: 127.011 },
        { lat: 37.011, lng: 127.011 },
        { lat: 37.011, lng: 127.01 },
        { lat: 37.01, lng: 127.01 },
      ],
    });

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('대상 영토의 30% 이상을 직접 러닝해야 합니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('converts invalid polygon error to BadRequestException', async () => {
    runningLogRepo.findOne.mockResolvedValue({
      ...runningLog,
      path: [
        { lat: 37.0, lng: 127.0 },
        { lat: 37.0, lng: 127.001 },
      ],
    });

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('폐곡선 좌표가 부족합니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when target territory does not exist', async () => {
    territoryRepo.findOne.mockResolvedValue(null);

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('영토를 찾을 수 없습니다.');
  });

  it('throws NotFoundException when running log does not exist', async () => {
    runningLogRepo.findOne.mockResolvedValue(null);

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('러닝 기록을 찾을 수 없습니다.');
  });

  it('throws NotFoundException when attacker character does not exist', async () => {
    userCharacterRepo.findOne.mockResolvedValue(null);

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('보유 캐릭터를 찾을 수 없습니다.');
  });

  it('calculates KST day range regardless of server timezone', () => {
    const { start, end } = getKstDayRange(new Date('2026-05-26T12:00:00.000Z'));

    expect(start.toISOString()).toBe('2026-05-25T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-26T14:59:59.999Z');
  });
});
