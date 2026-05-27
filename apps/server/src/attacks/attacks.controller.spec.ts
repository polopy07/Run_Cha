import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AttacksController } from './attacks.controller';
import { AttacksService } from './attacks.service';
import { AttackTerritoryDto } from './dto/attack-territory.dto';

const mockAttacksService = {
  attack: jest.fn(),
};

function getAttackHandler() {
  return Object.getOwnPropertyDescriptor(AttacksController.prototype, 'attack')
    ?.value as (...args: unknown[]) => unknown;
}

describe('AttacksController', () => {
  let controller: AttacksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttacksController],
      providers: [
        { provide: AttacksService, useValue: mockAttacksService },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AttacksController>(AttacksController);
    jest.clearAllMocks();
  });

  it('POST /territories/:id/attack delegates to AttacksService with current user and dto', async () => {
    const user = { id: 1 } as User;
    const dto: AttackTerritoryDto = {
      runningLogId: 20,
      attackerCharacterId: 30,
    };
    const expected = {
      success: true,
      overlapRate: 100,
      contestedAreaSqm: 1000,
      damage: 25,
      occupationRateBefore: 100,
      occupationRateAfter: 75,
      acquiredAreaSqm: 250,
      neutralAreaSqm: 0,
      nextAttackAvailableAt: null,
      remainingDailyAttacks: 4,
      message: '침략에 성공했습니다.',
    };
    mockAttacksService.attack.mockResolvedValue(expected);

    const result = await controller.attack(user, 10, dto);

    expect(mockAttacksService.attack).toHaveBeenCalledWith(1, 10, dto);
    expect(result).toBe(expected);
  });

  it('uses JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      getAttackHandler(),
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('uses POST :id/attack route', () => {
    const routePath = Reflect.getMetadata(
      PATH_METADATA,
      getAttackHandler(),
    ) as string;
    const method = Reflect.getMetadata(
      METHOD_METADATA,
      getAttackHandler(),
    ) as RequestMethod;

    expect(routePath).toBe(':id/attack');
    expect(method).toBe(RequestMethod.POST);
  });
});
