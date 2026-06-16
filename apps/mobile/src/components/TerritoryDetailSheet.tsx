import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getTerritoryDetail,
  updateTerritoryName,
  type Territory,
  type TerritoryDetail,
  type TerritoryDeployedCharacter,
} from '../api/territory';
import { deployCharacter } from '../api/character';
import { useTheme } from '../contexts/ThemeContext';
import { radius, GRADE_LABEL } from '../constants/theme';
import { formatArea, formatProtectionRemaining } from '../utils/formatUtils';
import {
  canDeployCharacter,
  DEPLOY_SORT_OPTIONS,
  DEPLOY_TYPE_FILTER_OPTIONS,
  GRADE_ORDER,
  TYPE_ORDER,
  type DeploySortMode,
} from '../utils/deployUtils';
import {
  getCharacterImageSource,
  getCharacterImageTransform,
} from '../assets/characters/characterImages';
import useCharacterStore, { type Character } from '../store/characterStore';
import { getEstimatedTerritoryHourlyIncome } from '../utils/territoryIncomeUtils';

type Props = {
  visible: boolean;
  territoryId: number | null;
  territory?: Territory | null;
  onClose: () => void;
  onAttack?: (territoryId: number) => void;
};

const TYPE_LABEL: Record<Character['type'], string> = {
  attack: '공격형',
  defense: '수비형',
  buff: '버프형',
};

const TYPE_SHORT: Record<Character['type'], string> = {
  attack: 'ATK',
  defense: 'DEF',
  buff: 'BUF',
};

function CharacterCard({
  char,
  colors,
  gradeColor,
}: {
  char: TerritoryDeployedCharacter;
  colors: ReturnType<typeof useTheme>['colors'];
  gradeColor: ReturnType<typeof useTheme>['gradeColor'];
}) {
  const gc = gradeColor[char.grade] ?? colors.textMuted;
  const typeLabel = char.type === 'defense' ? '수비' : char.type === 'buff' ? '버프' : '공격';

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderLeftWidth: 3,
      borderLeftColor: gc,
      padding: 12,
      marginBottom: 8,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{
            width: 52, height: 52, borderRadius: radius.sm,
            backgroundColor: colors.card, overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Image
              source={getCharacterImageSource(char.grade, char.type)}
              style={{
                width: 60,
                height: 60,
                transform: getCharacterImageTransform(char.grade, char.type, 60),
              }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{char.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={{ backgroundColor: gc + '25', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: gc, fontSize: 11, fontWeight: '700' }}>{GRADE_LABEL[char.grade] ?? char.grade}</Text>
              </View>
              <View style={{ backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{typeLabel}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginLeft: 62 }}>
        <StatBadge label="ATK" value={char.attackLv} colors={colors} />
        <StatBadge label="DEF" value={char.defenseLv} colors={colors} />
        <StatBadge label="PNT" value={char.pointLv} colors={colors} />
      </View>
    </View>
  );
}

function StatBadge({ label, value, colors }: { label: string; value: number; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Lv.{value}</Text>
    </View>
  );
}

export function TerritoryDetailSheet({ visible, territoryId, territory, onClose, onAttack }: Props) {
  const { colors, gradeColor } = useTheme();
  const { characters, fetchCharacters, updateCharacter } = useCharacterStore();
  const [detail, setDetail] = useState<TerritoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showDeployPicker, setShowDeployPicker] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySortMode, setDeploySortMode] = useState<DeploySortMode>('recent');
  const [deployTypeFilter, setDeployTypeFilter] = useState<
    Extract<Character['type'], 'defense' | 'buff'> | null
  >(null);

  const displayName = detail?.name ?? territory?.name ?? (territoryId ? `영토 #${territoryId}` : '');
  const displayArea = detail?.areaSqm ?? territory?.areaSqm ?? 0;
  const displayRate = detail?.occupationRate ?? territory?.occupationRate ?? 0;

  const loadDetail = useCallback(async () => {
    if (territoryId == null) return;

    setLoadingDetail(true);
    try {
      const result = await getTerritoryDetail(territoryId);
      setDetail(result);
    } finally {
      setLoadingDetail(false);
    }
  }, [territoryId]);

  useEffect(() => {
    if (!visible || territoryId == null) {
      setDetail(null);
      setEditingName(false);
      setShowDeployPicker(false);
      return;
    }
    loadDetail()
      .catch(() => {})
      .finally(() => undefined);
    fetchCharacters().catch(() => undefined);
  }, [fetchCharacters, loadDetail, visible, territoryId]);

  const deployedCharacter = useMemo(() => {
    if (!detail) return null;
    return (
      characters.find(character => character.deployedTerritoryId === detail.id) ??
      null
    );
  }, [characters, detail]);

  const incomeCharacter = useMemo(() => {
    if (!detail) return null;
    return detail.deployedCharacters[0] ?? deployedCharacter;
  }, [deployedCharacter, detail]);

  const income = useMemo(
    () =>
      getEstimatedTerritoryHourlyIncome(
        displayArea,
        displayRate,
        incomeCharacter,
      ),
    [displayArea, displayRate, incomeCharacter],
  );
  const hasBuffIncome = incomeCharacter?.type === 'buff';

  const deployableCharacters = useMemo(() => {
    const visibleCharacters = characters.filter(character => {
      if (!canDeployCharacter(character) || character.deployedTerritoryId !== null) {
        return false;
      }

      return deploySortMode !== 'type' || deployTypeFilter === null
        ? true
        : character.type === deployTypeFilter;
    });

    return [...visibleCharacters].sort((a, b) => {
      if (deploySortMode === 'grade') {
        return GRADE_ORDER[b.grade] - GRADE_ORDER[a.grade] || b.id - a.id;
      }

      if (deploySortMode === 'type') {
        return TYPE_ORDER[b.type] - TYPE_ORDER[a.type] || b.id - a.id;
      }

      return b.id - a.id;
    });
  }, [characters, deploySortMode, deployTypeFilter]);

  const handleSaveName = async () => {
    if (!detail || !nameInput.trim()) return;
    if (nameInput.trim() === detail.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const res = await updateTerritoryName(detail.id, nameInput.trim());
      setDetail(prev => prev ? { ...prev, name: res.name } : prev);
      setEditingName(false);
    } catch {
      Alert.alert('오류', '이름 변경에 실패했습니다.');
    } finally {
      setSavingName(false);
    }
  };

  const refreshAfterDeploy = async (updated: Character) => {
    updateCharacter(updated);
    await loadDetail();
  };

  const submitDeploy = async (character: Character) => {
    if (!detail || isDeploying) return;

    setIsDeploying(true);
    try {
      const updated = await deployCharacter(character.id, detail.id);
      await refreshAfterDeploy(updated);
      setShowDeployPicker(false);
      Alert.alert('배치 완료', `${character.name}을 배치했습니다.`);
    } catch {
      Alert.alert('배치 실패', '캐릭터를 배치하지 못했습니다.');
    } finally {
      setIsDeploying(false);
    }
  };

  const submitUndeploy = async () => {
    if (!deployedCharacter || isDeploying) return;

    setIsDeploying(true);
    try {
      const updated = await deployCharacter(deployedCharacter.id, null);
      await refreshAfterDeploy(updated);
      Alert.alert('회수 완료', `${deployedCharacter.name}을 회수했습니다.`);
    } catch {
      Alert.alert('회수 실패', '캐릭터를 회수하지 못했습니다.');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>

      <View style={{
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
        maxHeight: '70%',
      }}>
        <View style={{ width: 40, height: 4, backgroundColor: colors.divider, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

        {(territory || detail) && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 영토 이름 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {editingName ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: '700',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.primary,
                      paddingVertical: 4,
                    }}
                    value={nameInput}
                    onChangeText={setNameInput}
                    maxLength={50}
                    autoFocus
                    placeholder="영토 이름"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity onPress={handleSaveName} disabled={savingName}>
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                      {savingName ? '...' : '저장'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>취소</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                    {displayName}
                  </Text>
                  {detail?.isMine && (
                    <TouchableOpacity onPress={() => { setNameInput(detail.name ?? ''); setEditingName(true); }}>
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>이름 수정</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* 보유자 */}
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
              {detail ? (detail.isMine ? '내 영토' : `보유자: ${detail.owner.nickname}`) : '불러오는 중...'}
            </Text>

            {/* 면적 / 점령률 */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{
                flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
                padding: 14, alignItems: 'center',
              }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>면적</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{formatArea(displayArea)}</Text>
              </View>
              <View style={{
                flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
                padding: 14, alignItems: 'center',
              }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>점령률</Text>
                <Text style={{
                  color: displayRate > 50 ? colors.primary : colors.danger,
                  fontSize: 16, fontWeight: '800',
                }}>
                  {displayRate}%
                </Text>
              </View>
            </View>

            {detail?.isMine && (
              <View
                style={{
                  backgroundColor: hasBuffIncome ? colors.primaryDim : colors.surface,
                  borderColor: hasBuffIncome ? colors.primary : colors.divider,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      시간당 예상 수익
                    </Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 20,
                        fontWeight: '900',
                        marginTop: 4,
                      }}
                    >
                      +{income.estimatedPoints.toLocaleString()}P
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: radius.full,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: hasBuffIncome ? colors.primary : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: '900',
                      }}
                    >
                      {hasBuffIncome
                        ? `버프 x${income.multiplier.toFixed(2)}`
                        : '기본 수익'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                  기준 수익 {income.baseIncome.toFixed(2)}P/h
                  {hasBuffIncome ? '에서 포인트 배율이 적용됩니다.' : ''}
                </Text>
              </View>
            )}

            {/* 배치 캐릭터 */}
            {loadingDetail ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : detail ? (
              <>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                  배치된 캐릭터 {detail.deployedCharacters.length > 0 ? `(${detail.deployedCharacters.length})` : ''}
                </Text>

                {detail.deployedCharacters.length === 0 ? (
                  <View style={{
                    backgroundColor: colors.surface, borderRadius: radius.md,
                    padding: 20, alignItems: 'center', marginBottom: 16,
                  }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>배치된 캐릭터가 없습니다</Text>
                  </View>
                ) : (
                  <View style={{ marginBottom: 16 }}>
                    {detail.deployedCharacters.map(c => (
                      <CharacterCard
                        key={c.id}
                        char={c}
                        colors={colors}
                        gradeColor={gradeColor}
                      />
                    ))}
                    {detail.isMine && deployedCharacter && (
                      <TouchableOpacity
                        onPress={submitUndeploy}
                        disabled={isDeploying}
                        activeOpacity={0.85}
                        style={{
                          backgroundColor: colors.dangerDim,
                          borderRadius: radius.md,
                          paddingVertical: 12,
                          alignItems: 'center',
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '800' }}>
                          {isDeploying ? '회수 중...' : '배치 회수'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {detail.isMine &&
                  detail.deployedCharacters.length === 0 &&
                  !deployedCharacter && (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowDeployPicker(current => !current)}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: radius.lg,
                        paddingVertical: 14,
                        alignItems: 'center',
                        marginBottom: showDeployPicker ? 12 : 16,
                      }}
                    >
                      <Text style={{ color: colors.bg, fontSize: 15, fontWeight: '800' }}>
                        캐릭터 배치
                      </Text>
                    </TouchableOpacity>

                    {showDeployPicker && (
                      <View style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                          {DEPLOY_SORT_OPTIONS.map(option => {
                            const active = deploySortMode === option.value;
                            return (
                              <TouchableOpacity
                                key={option.value}
                                activeOpacity={0.8}
                                onPress={() => {
                                  setDeploySortMode(option.value);
                                  if (option.value !== 'type') {
                                    setDeployTypeFilter(null);
                                  }
                                }}
                                style={{
                                  backgroundColor: active ? colors.primary : colors.surface,
                                  borderColor: active ? colors.primary : colors.divider,
                                  borderRadius: radius.full,
                                  borderWidth: 1,
                                  minWidth: 58,
                                  paddingHorizontal: 13,
                                  paddingVertical: 8,
                                  alignItems: 'center',
                                }}
                              >
                                <Text
                                  style={{
                                    color: active ? colors.bg : colors.textSecondary,
                                    fontSize: 12,
                                    fontWeight: '800',
                                  }}
                                >
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {deploySortMode === 'type' && (
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                            {DEPLOY_TYPE_FILTER_OPTIONS.map(option => {
                              const active = deployTypeFilter === option.value;
                              return (
                                <TouchableOpacity
                                  key={option.value}
                                  activeOpacity={0.8}
                                  onPress={() =>
                                    setDeployTypeFilter(current =>
                                      current === option.value ? null : option.value,
                                    )
                                  }
                                  style={{
                                    flex: 1,
                                    backgroundColor: active ? colors.primaryDim : colors.surface,
                                    borderColor: active ? colors.primary : colors.divider,
                                    borderRadius: radius.full,
                                    borderWidth: 1,
                                    paddingVertical: 8,
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active ? colors.primary : colors.textSecondary,
                                      fontSize: 12,
                                      fontWeight: '800',
                                    }}
                                  >
                                    {option.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {deployableCharacters.length === 0 ? (
                          <View
                            style={{
                              backgroundColor: colors.surface,
                              borderRadius: radius.md,
                              padding: 20,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                              배치 가능한 수비형/버프형 캐릭터가 없습니다.
                            </Text>
                          </View>
                        ) : (
                          deployableCharacters.map(character => {
                            const gc = gradeColor[character.grade] ?? colors.textMuted;
                            return (
                              <TouchableOpacity
                                key={character.id}
                                activeOpacity={0.85}
                                disabled={isDeploying}
                                onPress={() => submitDeploy(character)}
                                style={{
                                  backgroundColor: colors.surface,
                                  borderColor: colors.divider,
                                  borderRadius: radius.md,
                                  borderWidth: 1,
                                  marginBottom: 8,
                                  padding: 12,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 12,
                                }}
                              >
                                <View
                                  style={{
                                    width: 62,
                                    height: 62,
                                    borderRadius: radius.sm,
                                    backgroundColor: colors.card,
                                    overflow: 'hidden',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Image
                                    source={getCharacterImageSource(
                                      character.grade,
                                      character.type,
                                    )}
                                    style={{
                                      width: 72,
                                      height: 72,
                                      transform: getCharacterImageTransform(
                                        character.grade,
                                        character.type,
                                        72,
                                      ),
                                    }}
                                    resizeMode="contain"
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                      marginBottom: 4,
                                    }}
                                  >
                                    <View
                                      style={{
                                        backgroundColor: gc + '25',
                                        borderRadius: radius.sm,
                                        paddingHorizontal: 7,
                                        paddingVertical: 3,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: gc,
                                          fontSize: 10,
                                          fontWeight: '900',
                                        }}
                                      >
                                        {GRADE_LABEL[character.grade] ?? character.grade}
                                      </Text>
                                    </View>
                                    <Text
                                      style={{
                                        color: colors.textMuted,
                                        fontSize: 11,
                                        fontWeight: '800',
                                      }}
                                    >
                                      {TYPE_SHORT[character.type]}
                                    </Text>
                                  </View>
                                  <Text
                                    style={{
                                      color: colors.text,
                                      fontSize: 15,
                                      fontWeight: '800',
                                    }}
                                  >
                                    {character.name}
                                  </Text>
                                  <Text
                                    style={{
                                      color: colors.textSecondary,
                                      fontSize: 12,
                                      marginTop: 3,
                                    }}
                                  >
                                    {TYPE_LABEL[character.type]} · DEF{' '}
                                    {character.defenseLv} · PT {character.pointLv}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    )}
                  </>
                )}

                {!detail.isMine && onAttack && (() => {
                  const isProtected =
                    detail.protectedUntil !== null &&
                    new Date(detail.protectedUntil).getTime() > Date.now();
                  const remaining = isProtected
                    ? formatProtectionRemaining(detail.protectedUntil!)
                    : '';
                  return (
                    <>
                      {isProtected && (
                        <View style={{
                          backgroundColor: colors.surface,
                          borderRadius: radius.md,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          marginBottom: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}>
                          <Text style={{ fontSize: 14 }}>🛡️</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                            보호 중 · {remaining} 남음
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => !isProtected && onAttack(detail.id)}
                        activeOpacity={isProtected ? 1 : 0.85}
                        style={{
                          backgroundColor: isProtected ? colors.surface : colors.danger,
                          borderRadius: radius.lg,
                          paddingVertical: 14,
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{
                          color: isProtected ? colors.textMuted : '#fff',
                          fontSize: 16,
                          fontWeight: '800',
                        }}>
                          침략하기
                        </Text>
                      </TouchableOpacity>
                    </>
                  );
                })()}
              </>
            ) : null}

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.surface, borderRadius: radius.lg,
                paddingVertical: 14, alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '700' }}>닫기</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
