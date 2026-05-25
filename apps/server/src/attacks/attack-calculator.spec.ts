import {
  calculateAcquiredAreaSqm,
  calculateAttackOutcome,
  calculateAttackPower,
  calculateDefenseWithRate,
  calculateDefensePower,
  calculateDamage,
  calculateOccupationRateAfter,
  calculateRawDamage,
} from './attack-calculator';

function attacker(baseAttack: number, attackLv: number) {
  return {
    attack_lv: attackLv,
    character: { base_attack: baseAttack },
  };
}

function defender(baseDefense: number, defenseLv: number) {
  return {
    defense_lv: defenseLv,
    character: { base_defense: baseDefense },
  };
}

describe('attack calculator', () => {
  it('calculates attack power from character base_attack and attack_lv', () => {
    expect(calculateAttackPower(attacker(20, 3))).toBe(30);
  });

  it('handles float base attack stats correctly', () => {
    expect(calculateAttackPower(attacker(10.5, 2))).toBe(15.5);
  });

  it('calculates defense power from deployed defenders', () => {
    expect(calculateDefensePower([defender(10, 2), defender(8, 4)])).toBe(38);
  });

  it('handles float base defense stats correctly', () => {
    expect(calculateDefensePower([defender(10.5, 2)])).toBe(15.5);
  });

  it('returns zero defense power when there are no deployed defenders', () => {
    expect(calculateDefensePower([])).toBe(0);
  });

  it('scales defense power by occupation rate', () => {
    expect(calculateDefenseWithRate(20, 50)).toBe(10);
    expect(calculateDefenseWithRate(20, 0)).toBe(0);
    expect(calculateDefenseWithRate(20, 100)).toBe(20);
  });

  it('does not create negative raw damage when defense is higher', () => {
    expect(calculateRawDamage(10, 30)).toBe(0);
  });

  it('floors raw damage into actual occupation rate damage', () => {
    expect(calculateDamage(7.9)).toBe(7);
  });

  it('does not reduce occupation rate below zero', () => {
    expect(calculateOccupationRateAfter(8, 20)).toBe(0);
  });

  it('calculates acquired area from reduced occupation rate', () => {
    expect(calculateAcquiredAreaSqm(2000, 80, 55)).toBe(500);
  });

  it('keeps decimal acquired area when territory area is a float', () => {
    expect(calculateAcquiredAreaSqm(1234.56, 80, 63)).toBeCloseTo(209.8752);
  });

  it('calculates successful attack outcome without defenders', () => {
    const result = calculateAttackOutcome({
      attackerCharacter: attacker(12, 2),
      deployedDefenders: [],
      territory: { area_sqm: 1000, occupation_rate: 100 },
    });

    expect(result).toEqual({
      attackPower: 17,
      defensePower: 0,
      defenseWithRate: 0,
      rawDamage: 17,
      damage: 17,
      occupationRateBefore: 100,
      occupationRateAfter: 83,
      acquiredAreaSqm: 170,
      success: true,
    });
  });

  it('reduces damage by deployed defender power and occupation rate', () => {
    const result = calculateAttackOutcome({
      attackerCharacter: attacker(30, 1),
      deployedDefenders: [defender(10, 2)],
      territory: { area_sqm: 1000, occupation_rate: 50 },
    });

    expect(result).toEqual({
      attackPower: 30,
      defensePower: 15,
      defenseWithRate: 7.5,
      rawDamage: 22.5,
      damage: 22,
      occupationRateBefore: 50,
      occupationRateAfter: 28,
      acquiredAreaSqm: 220,
      success: true,
    });
  });

  it('marks attack as failed when no occupation rate is reduced', () => {
    const result = calculateAttackOutcome({
      attackerCharacter: attacker(10, 1),
      deployedDefenders: [defender(20, 1)],
      territory: { area_sqm: 1000, occupation_rate: 100 },
    });

    expect(result.damage).toBe(0);
    expect(result.occupationRateAfter).toBe(100);
    expect(result.acquiredAreaSqm).toBe(0);
    expect(result.success).toBe(false);
  });
});
