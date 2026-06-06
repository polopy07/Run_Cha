import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { deployCharacter } from '../api/character';
import {
  getMyTerritories,
  updateTerritoryName,
  type Territory,
} from '../api/territory';
import { radius, spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import type { MenuStackParamList } from '../navigation/MenuStack';
import { formatArea } from '../utils/formatUtils';
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

type Props = StackScreenProps<MenuStackParamList, 'MyTerritories'>;

const TYPE_LABEL: Record<Character['type'], string> = {
  attack: '공격형',
  defense: '수비형',
  buff: '버프형',
};

const GRADE_LABEL: Record<Character['grade'], string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
};

const TYPE_SHORT: Record<Character['type'], string> = {
  attack: 'ATK',
  defense: 'DEF',
  buff: 'BUF',
};

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}.${day} ${hour}:${minute}`;
}

function getTerritoryTitle(territory: Territory) {
  return territory.name?.trim() || `영토 #${territory.id}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function MyTerritoriesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, gradeColor } = useTheme();
  const { characters, fetchCharacters, updateCharacter } = useCharacterStore();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedTerritory, setSelectedTerritory] =
    useState<Territory | null>(null);
  const [namingTerritory, setNamingTerritory] = useState<Territory | null>(
    null,
  );
  const [nameInput, setNameInput] = useState('');
  const [deploySortMode, setDeploySortMode] = useState<DeploySortMode>('recent');
  const [deployTypeFilter, setDeployTypeFilter] = useState<
    Extract<Character['type'], 'defense' | 'buff'> | null
  >(null);

  const totalArea = useMemo(
    () => territories.reduce((sum, territory) => sum + territory.areaSqm, 0),
    [territories],
  );

  const totalEstimatedHourlyIncome = useMemo(
    () => {
      const rawIncome = territories.reduce((sum, territory) => {
        const deployedCharacter =
          characters.find(
            character => character.deployedTerritoryId === territory.id,
          ) ?? null;
        const income = getEstimatedTerritoryHourlyIncome(
          territory.areaSqm,
          territory.occupationRate,
          deployedCharacter,
        );

        return sum + income.rawIncome;
      }, 0);

      return Math.floor(rawIncome);
    },
    [characters, territories],
  );

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

  const load = useCallback(async () => {
    try {
      const [territoryResult] = await Promise.all([
        getMyTerritories(),
        fetchCharacters(),
      ]);
      setTerritories(territoryResult);
    } catch (error) {
      Alert.alert(
        '영토 조회 실패',
        getErrorMessage(error, '보유 영토를 불러오지 못했습니다.'),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchCharacters]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    load().catch(() => undefined);
  }, [load]);

  const openNameModal = (territory: Territory) => {
    setNamingTerritory(territory);
    setNameInput(territory.name ?? '');
  };

  const closeNameModal = () => {
    if (isSavingName) return;
    setNamingTerritory(null);
    setNameInput('');
  };

  const applyTerritoryName = (id: number, name: string | null) => {
    setTerritories(current =>
      current.map(territory =>
        territory.id === id ? { ...territory, name } : territory,
      ),
    );
  };

  const saveName = async () => {
    if (!namingTerritory) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('이름 입력', '영토 이름을 입력해주세요.');
      return;
    }

    setIsSavingName(true);
    try {
      const result = await updateTerritoryName(namingTerritory.id, trimmed);
      applyTerritoryName(namingTerritory.id, result.name);
      setNamingTerritory(null);
      setNameInput('');
    } catch (error) {
      Alert.alert(
        '이름 변경 실패',
        getErrorMessage(error, '영토 이름을 변경하지 못했습니다.'),
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const clearName = async () => {
    if (!namingTerritory) return;

    setIsSavingName(true);
    try {
      const result = await updateTerritoryName(namingTerritory.id, null);
      applyTerritoryName(namingTerritory.id, result.name);
      setNamingTerritory(null);
      setNameInput('');
    } catch (error) {
      Alert.alert(
        '이름 삭제 실패',
        getErrorMessage(error, '영토 이름을 삭제하지 못했습니다.'),
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const getDeployedCharacter = useCallback(
    (territoryId: number) =>
      characters.find(character => character.deployedTerritoryId === territoryId) ??
      null,
    [characters],
  );

  const submitDeploy = async (character: Character) => {
    if (!selectedTerritory || isDeploying) return;

    setIsDeploying(true);
    try {
      const updated = await deployCharacter(character.id, selectedTerritory.id);
      updateCharacter(updated);
      setSelectedTerritory(null);
      Alert.alert('배치 완료', `${character.name}을 배치했습니다.`);
    } catch (error) {
      Alert.alert(
        '배치 실패',
        getErrorMessage(error, '캐릭터를 배치하지 못했습니다.'),
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const submitUndeploy = async (character: Character) => {
    if (isDeploying) return;

    setIsDeploying(true);
    try {
      const updated = await deployCharacter(character.id, null);
      updateCharacter(updated);
      setSelectedTerritory(null);
      Alert.alert('회수 완료', `${character.name}을 회수했습니다.`);
    } catch (error) {
      Alert.alert(
        '회수 실패',
        getErrorMessage(error, '캐릭터를 회수하지 못했습니다.'),
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const renderTerritory = ({ item }: { item: Territory }) => {
    const deployedCharacter = getDeployedCharacter(item.id);
    const income = getEstimatedTerritoryHourlyIncome(
      item.areaSqm,
      item.occupationRate,
      deployedCharacter,
    );
    const hasBuffIncome = deployedCharacter?.type === 'buff';

    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: radius.md,
          borderWidth: 1,
          padding: spacing.lg,
          marginBottom: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}
            >
              {getTerritoryTitle(item)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              ID {item.id}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => openNameModal(item)}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.primaryDim,
              borderRadius: radius.sm,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}
            >
              이름 수정
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing.lg,
            borderTopColor: colors.divider,
            borderTopWidth: 1,
            paddingTop: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>면적</Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              {formatArea(item.areaSqm)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>점령률</Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              {item.occupationRate}%
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>활동</Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              {formatDate(item.lastActiveAt)}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: hasBuffIncome ? colors.primaryDim : colors.card,
            borderColor: hasBuffIncome ? colors.primary : colors.divider,
            borderRadius: radius.sm,
            borderWidth: 1,
            marginTop: spacing.md,
            padding: spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                시간당 예상 수익
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 17,
                  fontWeight: '900',
                  marginTop: 4,
                }}
              >
                +{income.estimatedPoints.toLocaleString()}P
              </Text>
            </View>
            <Text
              style={{
                color: hasBuffIncome ? colors.primary : colors.textSecondary,
                fontSize: 12,
                fontWeight: '800',
              }}
            >
              {hasBuffIncome
                ? `버프 x${income.multiplier.toFixed(2)}`
                : '기본 수익'}
            </Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
            기준 수익 {income.baseIncome.toFixed(2)}P/h
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.sm,
            marginTop: spacing.md,
            padding: spacing.md,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            배치 캐릭터
          </Text>
          {deployedCharacter ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: spacing.md,
                marginTop: 6,
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Image
                    source={getCharacterImageSource(
                      deployedCharacter.grade,
                      deployedCharacter.type,
                    )}
                    style={{
                      width: 64,
                      height: 64,
                      transform: getCharacterImageTransform(
                        deployedCharacter.grade,
                        deployedCharacter.type,
                        64,
                      ),
                    }}
                    resizeMode="contain"
                  />
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: '800',
                  }}
                >
                  {deployedCharacter.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {TYPE_LABEL[deployedCharacter.type]} /{' '}
                  {GRADE_LABEL[deployedCharacter.grade]}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => submitUndeploy(deployedCharacter)}
                style={{
                  backgroundColor: colors.dangerDim,
                  borderRadius: radius.full,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontSize: 12,
                    fontWeight: '800',
                  }}
                >
                  회수
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
              배치된 캐릭터가 없습니다
            </Text>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={deployedCharacter !== null || isDeploying}
          onPress={() => setSelectedTerritory(item)}
          style={{
            backgroundColor:
              deployedCharacter !== null ? colors.divider : colors.primary,
            borderRadius: radius.md,
            marginTop: spacing.md,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: deployedCharacter !== null ? colors.textMuted : colors.bg,
              fontSize: 14,
              fontWeight: '900',
            }}
          >
            {deployedCharacter !== null ? '배치 중' : '캐릭터 배치'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomColor: colors.divider,
          borderBottomWidth: 1,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={{ color: colors.text, fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: '800',
            marginLeft: 12,
          }}
        >
          내 영토 관리
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={territories}
          keyExtractor={item => String(item.id)}
          renderItem={renderTerritory}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 24,
            flexGrow: 1,
          }}
          ListHeaderComponent={
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderRadius: radius.lg,
                borderWidth: 1,
                marginBottom: spacing.lg,
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                보유 영토
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 28,
                  fontWeight: '900',
                  marginTop: 4,
                }}
              >
                {territories.length.toLocaleString()}개
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
                총 면적 {formatArea(totalArea)}
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: '800',
                  marginTop: 6,
                }}
              >
                시간당 예상 수익 +{totalEstimatedHourlyIncome.toLocaleString()}P
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                paddingVertical: 80,
              }}
            >
              <Text
                style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}
              >
                보유 영토가 없습니다
              </Text>
              <Text
                style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}
              >
                러닝으로 폐곡선을 만들면 영토가 생성됩니다.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <Modal
        visible={namingTerritory !== null}
        transparent
        animationType="fade"
        onRequestClose={closeNameModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={closeNameModal}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              borderRadius: radius.lg,
              borderWidth: 1,
              padding: 20,
            }}
            onPress={() => undefined}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              영토 이름 수정
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={100}
              placeholder="영토 이름"
              placeholderTextColor={colors.textMuted}
              style={{
                borderColor: colors.divider,
                borderRadius: radius.md,
                borderWidth: 1,
                color: colors.text,
                fontSize: 16,
                marginTop: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSavingName}
                onPress={clearName}
                style={{
                  backgroundColor: colors.dangerDim,
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: isSavingName ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ color: colors.danger, fontSize: 14, fontWeight: '800' }}
                >
                  이름 삭제
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSavingName}
                onPress={saveName}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: isSavingName ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ color: colors.bg, fontSize: 14, fontWeight: '900' }}
                >
                  {isSavingName ? '저장 중' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectedTerritory !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !isDeploying && setSelectedTerritory(null)}
      >
        <Pressable
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          onPress={() => !isDeploying && setSelectedTerritory(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: 20,
              paddingBottom: insets.bottom + 20,
            }}
            onPress={() => undefined}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.divider,
                alignSelf: 'center',
                marginBottom: 14,
              }}
            />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              캐릭터 배치
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {selectedTerritory ? getTerritoryTitle(selectedTerritory) : ''}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginTop: 16,
              }}
            >
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
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.divider,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      minWidth: 58,
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.bg : colors.textSecondary,
                        fontSize: 13,
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
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 10,
                }}
              >
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
                        backgroundColor: active
                          ? colors.primaryDim
                          : colors.card,
                        borderColor: active ? colors.primary : colors.divider,
                        borderRadius: radius.full,
                        borderWidth: 1,
                        paddingVertical: 9,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.primary : colors.textSecondary,
                          fontSize: 13,
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
              <Text
                style={{
                  color: colors.textMuted,
                  textAlign: 'center',
                  paddingVertical: 32,
                }}
              >
                배치 가능한 수비형/버프형 캐릭터가 없습니다.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 390, marginTop: 16 }}>
                {deployableCharacters.map(character => (
                  <TouchableOpacity
                    key={character.id}
                    activeOpacity={0.85}
                    disabled={isDeploying}
                    onPress={() => submitDeploy(character)}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.divider,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      marginBottom: 10,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: radius.sm,
                        backgroundColor: colors.surface,
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
                          width: 78,
                          height: 78,
                          transform: getCharacterImageTransform(
                            character.grade,
                            character.type,
                            78,
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
                          marginBottom: 5,
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: `${
                              gradeColor[character.grade] ?? colors.gradeCommon
                            }22`,
                            borderRadius: radius.sm,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                gradeColor[character.grade] ??
                                colors.gradeCommon,
                              fontSize: 10,
                              fontWeight: '900',
                            }}
                          >
                            {GRADE_LABEL[character.grade]}
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
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
