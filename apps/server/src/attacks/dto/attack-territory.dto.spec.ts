import { validate } from 'class-validator';
import { AttackTerritoryDto } from './attack-territory.dto';

function makeDto(value: Partial<AttackTerritoryDto>) {
  const dto = new AttackTerritoryDto();
  Object.assign(dto, value);
  return dto;
}

describe('AttackTerritoryDto', () => {
  it('accepts positive integer ids', async () => {
    const dto = makeDto({
      runningLogId: 1,
      attackerCharacterId: 2,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects missing runningLogId', async () => {
    const errors = await validate(makeDto({ attackerCharacterId: 2 }));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'runningLogId' }),
      ]),
    );
  });

  it('rejects missing attackerCharacterId', async () => {
    const errors = await validate(makeDto({ runningLogId: 1 }));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'attackerCharacterId' }),
      ]),
    );
  });

  it('rejects ids less than one', async () => {
    const errors = await validate(
      makeDto({ runningLogId: 0, attackerCharacterId: -1 }),
    );

    expect(errors).toHaveLength(2);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['runningLogId', 'attackerCharacterId']),
    );
  });

  it('rejects non-integer ids', async () => {
    const errors = await validate(
      makeDto({ runningLogId: 1.5, attackerCharacterId: 2.5 }),
    );

    expect(errors).toHaveLength(2);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['runningLogId', 'attackerCharacterId']),
    );
  });
});
