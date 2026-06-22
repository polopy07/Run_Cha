import * as turf from '@turf/turf';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, MoreThan } from 'typeorm';
import { AttacksService, getKstDayRange } from './attacks.service';
import { toPolygon } from './attack-overlap';
import { AttackLog } from './entities/attack-log.entity';
import { AttackResult } from './enums/attack-result.enum';
import { CharacterType } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
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

const FAR_SQUARE = [
  { lat: 37.01, lng: 127.01 },
  { lat: 37.01, lng: 127.011 },
  { lat: 37.011, lng: 127.011 },
  { lat: 37.011, lng: 127.01 },
  { lat: 37.01, lng: 127.01 },
];

const SQUARE_AREA_SQM = turf.area(toPolygon(SQUARE));
const HALF_SQUARE_AREA_SQM = turf.area(toPolygon(HALF_SQUARE));

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

describe('AttacksService', () => {
  let service: AttacksService;
  let territoryRepo: MockRepository;
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
    area_sqm: SQUARE_AREA_SQM,
    occupation_rate: 100,
  } as Territory;

  // 공격자 영토는 상대 영토(SQUARE)의 왼쪽 절반과 겹침 → overlapRate ≈ 50%
  const attackerOwnedTerritory = {
    id: 11,
    user_id: 1,
    coordinates: HALF_SQUARE,
    area_sqm: HALF_SQUARE_AREA_SQM,
    occupation_rate: 100,
    center_lat: 37.0005,
    center_lng: 127.00025,
  } as Territory;

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
    userCharacterRepo.findOne.mockResolvedValue(attackerCharacter);
    userCharacterRepo.find.mockResolvedValue([]);
    transactionAttackLogRepo.count.mockResolvedValue(0);
    transactionAttackLogRepo.save.mockImplementation((value: unknown) =>
      Promise.resolve({ ...(value as object), created_at: new Date() }),
    );
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

  it('updates defender territory and saves attack log on success', async () => {
    const result = await service.attack(1, 10, {
      attackerCharacterId: 30,
    });

    expect(result.success).toBe(true);
    expect(result.damage).toBe(25);
    expect(result.occupationRateBefore).toBe(100);
    expect(result.occupationRateAfter).toBe(75);
    expect(result.overlapRate).toBeGreaterThan(49);
    expect(result.overlapRate).toBeLessThan(51);
    expect(result.acquiredAreaSqm).toBeGreaterThan(0);
    expect(result.remainingDailyAttacks).toBe(4);
    expect(result.nextAttackAvailableAt).toEqual(expect.any(String));
    expect(result.message).toBe('침략에 성공했습니다.');
    expect(territoryRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: 10,
        area_sqm: MoreThan(0),
        occupation_rate: MoreThan(0),
      },
    });

    // 공격자 영토는 이미 겹친 영역을 포함하므로 저장 없음 — defender만 1회 저장
    expect(transactionTerritoryRepo.save).toHaveBeenCalledTimes(1);
    const savedDefender = getSavedTerritory(transactionTerritoryRepo, 0);
    expect(savedDefender).toEqual(
      expect.objectContaining({ user_id: 2, occupation_rate: 75 }),
    );
    expect(typeof savedDefender.area_sqm).toBe('number');
    expect(savedDefender.area_sqm).toBeGreaterThan(0);

    expect(transactionAttackLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        attacker_id: 1,
        defender_id: 2,
        territory_id: 10,
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
  });

  it('removes defender territory entirely when fully overlapped', async () => {
    // 공격자 영토가 상대 영토와 동일 → 100% 겹침
    territoryRepo.findOne.mockImplementation(
      (options?: { where?: Record<string, unknown> }) => {
        if (options?.where && 'id' in options.where) {
          return Promise.resolve({ ...territory });
        }
        if (options?.where && 'user_id' in options.where) {
          return Promise.resolve({ ...attackerOwnedTerritory, coordinates: SQUARE });
        }

        return Promise.resolve(null);
      },
    );

    const result = await service.attack(1, 10, {
      attackerCharacterId: 30,
    });

    expect(result.success).toBe(true);
    expect(result.overlapRate).toBeCloseTo(100, 0);

    expect(transactionTerritoryRepo.save).toHaveBeenCalledTimes(1);
    const savedDefender = getSavedTerritory(transactionTerritoryRepo, 0);
    expect(savedDefender).toEqual(
      expect.objectContaining({ area_sqm: 0, occupation_rate: 0 }),
    );
  });

  it('saves deployed defender character id when defender is deployed', async () => {
    userCharacterRepo.find.mockResolvedValue([defenderCharacter]);

    await service.attack(1, 10, {
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
      attackerCharacterId: 30,
    });

    expect(result.success).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.occupationRateAfter).toBe(100);
    expect(result.acquiredAreaSqm).toBe(0);
    expect(result.nextAttackAvailableAt).toEqual(expect.any(String));
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
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('자신의 영토는 침략할 수 없습니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects protected newly created territory', async () => {
    territoryRepo.findOne.mockResolvedValue({
      ...territory,
      protected_until: new Date(Date.now() + 60_000),
    });

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('새로 생성된 영토는');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when attacker has no territory', async () => {
    territoryRepo.findOne
      .mockResolvedValueOnce({ ...territory })
      .mockResolvedValueOnce(null);

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('침략하려면 먼저 자신의 영토가 있어야 합니다.');

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when attacker territory does not overlap defender territory by 30%', async () => {
    territoryRepo.findOne.mockImplementation(
      (options?: { where?: Record<string, unknown> }) => {
        if (options?.where && 'id' in options.where) {
          return Promise.resolve({ ...territory });
        }
        if (options?.where && 'user_id' in options.where) {
          return Promise.resolve({ ...attackerOwnedTerritory, coordinates: FAR_SQUARE });
        }

        return Promise.resolve(null);
      },
    );

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('30% 이상이 내 영토와 겹쳐야 합니다.');

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when daily attack limit is reached', async () => {
    transactionAttackLogRepo.count.mockResolvedValueOnce(5);

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('오늘의 침략 가능 횟수를 모두 사용했습니다.');
    expect(transactionTerritoryRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when attack cooldown is active', async () => {
    transactionAttackLogRepo.findOne.mockResolvedValue({
      attacker_id: 1,
      created_at: new Date(Date.now() - 60_000),
    });

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('침략 쿨타임 중입니다.');
    expect(transactionTerritoryRepo.save).not.toHaveBeenCalled();
    expect(transactionAttackLogRepo.create).not.toHaveBeenCalled();
  });

  it('rejects when daily attack lock cannot be acquired', async () => {
    managerQuery.mockResolvedValueOnce([{ acquired: 0 }]);

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
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
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('공격형 캐릭터만 침략에 사용할 수 있습니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('converts invalid polygon error to BadRequestException', async () => {
    territoryRepo.findOne.mockImplementation(
      (options?: { where?: Record<string, unknown> }) => {
        if (options?.where && 'id' in options.where) {
          return Promise.resolve({ ...territory });
        }
        if (options?.where && 'user_id' in options.where) {
          return Promise.resolve({
            ...attackerOwnedTerritory,
            coordinates: [
              { lat: 37.0, lng: 127.0 },
              { lat: 37.0, lng: 127.001 },
            ],
          });
        }

        return Promise.resolve(null);
      },
    );

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('폐곡선 좌표가 부족합니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when target territory does not exist', async () => {
    territoryRepo.findOne.mockResolvedValue(null);

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('영토를 찾을 수 없습니다.');
  });

  it('throws NotFoundException when attacker character does not exist', async () => {
    userCharacterRepo.findOne.mockResolvedValue(null);

    await expect(
      service.attack(1, 10, { attackerCharacterId: 30 }),
    ).rejects.toThrow('보유 캐릭터를 찾을 수 없습니다.');
  });

  it('calculates KST day range regardless of server timezone', () => {
    const { start, end } = getKstDayRange(new Date('2026-05-26T12:00:00.000Z'));

    expect(start.toISOString()).toBe('2026-05-25T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-05-26T14:59:59.999Z');
  });
});
