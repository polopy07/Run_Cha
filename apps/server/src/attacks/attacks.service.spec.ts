import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AttacksService } from './attacks.service';
import { AttackLog } from './entities/attack-log.entity';
import { AttackResult } from './enums/attack-result.enum';
import { CharacterType } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { RunningLog } from '../running/entities/running-log.entity';
import { Territory } from '../territories/entities/territory.entity';

const SQUARE = [
  { lat: 37.0, lng: 127.0 },
  { lat: 37.0, lng: 127.001 },
  { lat: 37.001, lng: 127.001 },
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
};

describe('AttacksService', () => {
  let service: AttacksService;
  let territoryRepo: MockRepository;
  let runningLogRepo: MockRepository;
  let userCharacterRepo: MockRepository;
  let attackLogRepo: MockRepository;
  let transactionTerritoryRepo: MockRepository;
  let transactionAttackLogRepo: MockRepository;

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

  beforeEach(async () => {
    territoryRepo = makeRepository();
    runningLogRepo = makeRepository();
    userCharacterRepo = makeRepository();
    attackLogRepo = makeRepository();
    transactionTerritoryRepo = makeRepository();
    transactionAttackLogRepo = makeRepository();

    territoryRepo.findOne.mockResolvedValue({ ...territory });
    runningLogRepo.findOne.mockResolvedValue(runningLog);
    userCharacterRepo.findOne.mockResolvedValue(attackerCharacter);
    userCharacterRepo.find.mockResolvedValue([]);
    attackLogRepo.count.mockResolvedValue(0);
    dataSource.transaction.mockImplementation(
      (callback: (manager: MockTransactionManager) => void) =>
        callback({
          getRepository: (entity: unknown) =>
            entity === Territory
              ? transactionTerritoryRepo
              : transactionAttackLogRepo,
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
    expect(result.acquiredAreaSqm).toBe(3091);
    expect(result.neutralAreaSqm).toBe(0);
    expect(result.remainingDailyAttacks).toBe(4);
    expect(result.nextAttackAvailableAt).toBeNull();
    expect(result.message).toBe('침략에 성공했습니다.');
    expect(transactionTerritoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ occupation_rate: 75 }),
    );
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
  });

  it('rejects attacking own territory', async () => {
    territoryRepo.findOne.mockResolvedValue({ ...territory, user_id: 1 });

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('자신의 영토는 침략할 수 없습니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects when daily attack limit is reached', async () => {
    attackLogRepo.count.mockResolvedValue(5);

    await expect(
      service.attack(1, 10, { runningLogId: 20, attackerCharacterId: 30 }),
    ).rejects.toThrow('오늘의 침략 가능 횟수를 모두 사용했습니다.');
    expect(dataSource.transaction).not.toHaveBeenCalled();
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
});
