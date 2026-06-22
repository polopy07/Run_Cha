import { validate } from 'class-validator';
import { AttackTerritoryDto } from './attack-territory.dto';

function makeDto(value: Partial<AttackTerritoryDto>) {
  const dto = new AttackTerritoryDto();
  Object.assign(dto, value);
  return dto;
}

describe('AttackTerritoryDto', () => {
  it('accepts positive integer attackerCharacterId', async () => {
    const dto = makeDto({ attackerCharacterId: 2 });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects missing attackerCharacterId', async () => {
    const errors = await validate(makeDto({}));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'attackerCharacterId' }),
      ]),
    );
  });

  it('rejects attackerCharacterId less than one', async () => {
    const errors = await validate(makeDto({ attackerCharacterId: 0 }));

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('attackerCharacterId');
  });

  it('rejects non-integer attackerCharacterId', async () => {
    const errors = await validate(makeDto({ attackerCharacterId: 1.5 }));

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('attackerCharacterId');
  });
});
