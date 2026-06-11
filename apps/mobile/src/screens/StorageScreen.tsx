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
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CharacterStackParamList } from '../navigation/CharacterStack';
import {
  deployCharacter,
  dismantleCharacters,
  upgradeCharacter,
  type UpgradeStat,
} from '../api/character';
import { getMyTerritories, type Territory } from '../api/territory';
import useCharacterStore, { type Character } from '../store/characterStore';
import useAuthStore from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../constants/theme';
import {
  getCharacterImageSource,
  getCharacterImageTransform,
} from '../assets/characters/characterImages';

type Nav = StackNavigationProp<CharacterStackParamList, 'Storage'>;

const GRADE_LABEL: Record<Character['grade'], string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGEND',
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

type SortMode = 'recent' | 'grade' | 'type';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'recent', label: '최근' },
  { value: 'grade', label: '등급' },
  { value: 'type', label: '타입' },
];

const TYPE_FILTER_OPTIONS: {
  value: Character['type'];
  label: string;
}[] = [
  { value: 'attack', label: '공격형' },
  { value: 'defense', label: '수비형' },
  { value: 'buff', label: '버프형' },
];

const GRADE_ORDER: Record<Character['grade'], number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

const TYPE_ORDER: Record<Character['type'], number> = {
  attack: 3,
  defense: 2,
  buff: 1,
};

const STAT_ROWS: {
  stat: UpgradeStat;
  label: string;
  shortLabel: string;
  getLevel: (character: Character) => number;
}[] = [
  {
    stat: 'attack',
    label: '공격',
    shortLabel: 'ATK',
    getLevel: character => character.attackLv,
  },
  {
    stat: 'defense',
    label: '방어',
    shortLabel: 'DEF',
    getLevel: character => character.defenseLv,
  },
  {
    stat: 'point',
    label: '포인트 배율',
    shortLabel: 'PT',
    getLevel: character => character.pointLv,
  },
];

// Keep in sync with apps/server/src/characters/dto/dismantle-characters.dto.ts.
const DISMANTLE_MAX_COUNT = 29;

const DISMANTLE_REWARD_BY_GRADE: Record<Character['grade'], number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function formatArea(sqm: number) {
  return `${Math.round(sqm).toLocaleString()}㎡`;
}

function getErr(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isDeployed(character: Character) {
  return character.isDeployed || character.deployedTerritoryId !== null;
}

function getExperienceProgress(character: Character) {
  if (character.nextLevelExperience === null) {
    return 1;
  }
  if (character.experience == null || character.nextLevelExperience == null) {
    return 0;
  }
  return Math.min(
    1,
    Math.max(0, character.experience / character.nextLevelExperience),
  );
}

export function StorageScreen() {
  const { colors, gradeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const { characters, isLoading, fetchCharacters, updateCharacter } =
    useCharacterStore();
  const user = useAuthStore(state => state.user);
  const fetchMe = useAuthStore(state => state.fetchMe);
  const setRepresentative = useAuthStore(state => state.setRepresentative);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(
    null,
  );
  const [isDismantleMode, setIsDismantleMode] = useState(false);
  const [selectedDismantleIds, setSelectedDismantleIds] = useState<number[]>(
    [],
  );
  const [isDismantling, setIsDismantling] = useState(false);
  const [isSettingRepresentative, setIsSettingRepresentative] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [typeFilter, setTypeFilter] = useState<Character['type'] | null>(null);
  const [upgradingStat, setUpgradingStat] = useState<UpgradeStat | null>(null);

  const deployedIds = useMemo(
    () =>
      new Set(
        characters
          .map(character => character.deployedTerritoryId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    [characters],
  );

  const selectedDismantleCharacters = useMemo(
    () =>
      characters.filter(character =>
        selectedDismantleIds.includes(character.id),
      ),
    [characters, selectedDismantleIds],
  );

  const dismantlableCharacterCount = useMemo(
    () => characters.filter(character => !isDeployed(character)).length,
    [characters],
  );

  const expectedStatPoints = useMemo(
    () =>
      selectedDismantleCharacters.reduce(
        (sum, character) => sum + DISMANTLE_REWARD_BY_GRADE[character.grade],
        0,
      ),
    [selectedDismantleCharacters],
  );

  const maxSelectableDismantleCount = Math.min(
    DISMANTLE_MAX_COUNT,
    dismantlableCharacterCount,
    Math.max(0, characters.length - 1),
  );

  const sortedCharacters = useMemo(() => {
    const visibleCharacters =
      sortMode === 'type' && typeFilter
        ? characters.filter(character => character.type === typeFilter)
        : characters;

    return [...visibleCharacters].sort((a, b) => {
      if (sortMode === 'grade') {
        return GRADE_ORDER[b.grade] - GRADE_ORDER[a.grade] || b.id - a.id;
      }

      if (sortMode === 'type') {
        return TYPE_ORDER[b.type] - TYPE_ORDER[a.type] || b.id - a.id;
      }

      return b.id - a.id;
    });
  }, [characters, sortMode, typeFilter]);

  const load = useCallback(async () => {
    const [characterResult, territoryResult] = await Promise.allSettled([
      fetchCharacters(),
      getMyTerritories(),
    ]);

    setTerritories(
      territoryResult.status === 'fulfilled' ? territoryResult.value : [],
    );

    if (characterResult.status === 'rejected') {
      throw characterResult.reason;
    }
  }, [fetchCharacters]);

  useEffect(() => {
    load().catch(error => {
      Alert.alert(
        '불러오기 실패',
        getErr(error, '캐릭터 정보를 불러오지 못했습니다.'),
      );
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (error) {
      Alert.alert(
        '불러오기 실패',
        getErr(error, '캐릭터 정보를 불러오지 못했습니다.'),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const resetDismantleMode = useCallback(() => {
    setIsDismantleMode(false);
    setSelectedDismantleIds([]);
  }, []);

  const toggleDismantleMode = useCallback(() => {
    setSelected(null);
    setDetailCharacter(null);
    setSelectedDismantleIds([]);
    setIsDismantleMode(current => !current);
  }, []);

  const toggleDismantleSelection = useCallback(
    (character: Character) => {
      if (isDeployed(character)) {
        Alert.alert('분해 불가', '배치 중인 캐릭터는 분해할 수 없습니다.');
        return;
      }

      if (user?.representativeCharacter?.id === character.id) {
        Alert.alert(
          '대표 캐릭터 선택',
          '대표 캐릭터가 분해 대상에 포함됩니다. 실제 분해 전 다시 확인해주세요.',
        );
      }

      setSelectedDismantleIds(current => {
        if (current.includes(character.id)) {
          return current.filter(id => id !== character.id);
        }

        if (characters.length - (current.length + 1) < 1) {
          Alert.alert('분해 불가', '최소 1개의 캐릭터는 남아 있어야 합니다.');
          return current;
        }

        if (current.length >= DISMANTLE_MAX_COUNT) {
          Alert.alert(
            '선택 제한',
            `한 번에 최대 ${DISMANTLE_MAX_COUNT}개까지 분해할 수 있습니다.`,
          );
          return current;
        }

        return [...current, character.id];
      });
    },
    [characters.length, user?.representativeCharacter?.id],
  );

  const openCharacterDetail = useCallback(
    (character: Character) => {
      if (isDismantleMode) {
        toggleDismantleSelection(character);
        return;
      }

      setDetailCharacter(character);
    },
    [isDismantleMode, toggleDismantleSelection],
  );

  const openDeploy = useCallback((character: Character) => {
    if (character.type === 'attack') {
      Alert.alert(
        '배치 불가',
        '수비/버프 캐릭터만 영토에 배치할 수 있습니다.',
      );
      return;
    }

    setDetailCharacter(null);
    setSelected(character);
  }, []);

  const submitDeploy = async (territoryId: number | null) => {
    if (!selected) return;

    setIsDeploying(true);
    try {
      const updated = await deployCharacter(selected.id, territoryId);
      updateCharacter(updated);
      setSelected(null);
    } catch (error) {
      Alert.alert('배치 실패', getErr(error, '다시 시도해주세요.'));
    } finally {
      setIsDeploying(false);
    }
  };

  const executeDismantle = useCallback(async () => {
    if (selectedDismantleIds.length === 0 || isDismantling) return;

    setIsDismantling(true);
    try {
      const result = await dismantleCharacters(selectedDismantleIds);
      await Promise.all([fetchCharacters(), fetchMe()]);
      resetDismantleMode();
      Alert.alert(
        '분해 완료',
        `${result.dismantledCount}개 캐릭터를 분해했습니다. 스탯 포인트 +${result.earnedStatPoints}`,
      );
    } catch (error) {
      Alert.alert('분해 실패', getErr(error, '다시 시도해주세요.'));
    } finally {
      setIsDismantling(false);
    }
  }, [
    fetchCharacters,
    fetchMe,
    isDismantling,
    resetDismantleMode,
    selectedDismantleIds,
  ]);

  const confirmDismantle = useCallback(() => {
    if (selectedDismantleIds.length === 0) {
      Alert.alert('캐릭터 선택', '분해할 캐릭터를 선택해주세요.');
      return;
    }

    if (characters.length - selectedDismantleIds.length < 1) {
      Alert.alert('분해 불가', '최소 1개의 캐릭터는 남아 있어야 합니다.');
      return;
    }

    const includesRepresentative =
      user?.representativeCharacter?.id != null &&
      selectedDismantleIds.includes(user.representativeCharacter.id);
    const message = includesRepresentative
      ? `${selectedDismantleIds.length}개 캐릭터를 분해하고 스탯 포인트 ${expectedStatPoints}개를 얻을까요?\n\n대표 캐릭터가 포함되어 있어 대표 설정이 해제됩니다.`
      : `${selectedDismantleIds.length}개 캐릭터를 분해하고 스탯 포인트 ${expectedStatPoints}개를 얻을까요?`;

    Alert.alert(
      '캐릭터 분해',
      message,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '분해',
          style: 'destructive',
          onPress: () => {
            executeDismantle().catch(() => undefined);
          },
        },
      ],
    );
  }, [
    characters.length,
    executeDismantle,
    expectedStatPoints,
    selectedDismantleIds,
    user?.representativeCharacter?.id,
  ]);

  const handleUpgrade = useCallback(
    async (character: Character, stat: UpgradeStat) => {
      if (upgradingStat !== null) return;

      if ((user?.statPoints ?? 0) < 1) {
        Alert.alert(
          '강화 불가',
          '스탯 포인트가 부족합니다. 캐릭터를 분해해 획득할 수 있습니다.',
        );
        return;
      }

      setUpgradingStat(stat);
      try {
        const result = await upgradeCharacter(character.id, stat);
        const updated: Character = {
          ...character,
          attackLv: stat === 'attack' ? result.newLevel : character.attackLv,
          defenseLv: stat === 'defense' ? result.newLevel : character.defenseLv,
          pointLv: stat === 'point' ? result.newLevel : character.pointLv,
        };

        updateCharacter(updated);
        setDetailCharacter(updated);
        await fetchMe();
        Alert.alert(
          '강화 완료',
          `${STAT_ROWS.find(row => row.stat === stat)?.label ?? stat} Lv. ${
            result.newLevel
          }`,
        );
      } catch (error) {
        Alert.alert('강화 실패', getErr(error, '다시 시도해주세요.'));
      } finally {
        setUpgradingStat(null);
      }
    },
    [fetchMe, updateCharacter, upgradingStat, user?.statPoints],
  );

  const handleRepresentative = useCallback(
    async (character: Character) => {
      if (isDismantleMode || isSettingRepresentative) return;

      const isCurrentRepresentative =
        user?.representativeCharacter?.id === character.id;
      const action = isCurrentRepresentative ? '해제' : '설정';
      const message = isCurrentRepresentative
        ? `${character.name}의 대표 캐릭터 설정을 해제할까요?`
        : `${character.name}을(를) 대표 캐릭터로 설정할까요?`;

      Alert.alert(`대표 캐릭터 ${action}`, message, [
        { text: '취소', style: 'cancel' },
        {
          text: action,
          onPress: async () => {
            setIsSettingRepresentative(true);
            try {
              await setRepresentative(
                isCurrentRepresentative ? null : character.id,
              );
            } catch (error) {
              Alert.alert('설정 실패', getErr(error, '다시 시도해주세요.'));
            } finally {
              setIsSettingRepresentative(false);
            }
          },
        },
      ]);
    },
    [
      isDismantleMode,
      isSettingRepresentative,
      setRepresentative,
      user?.representativeCharacter?.id,
    ],
  );

  const renderItem = ({ item }: { item: Character }) => {
    const grade = gradeColor[item.grade] ?? colors.gradeCommon;
    const selectedForDismantle = selectedDismantleIds.includes(item.id);
    const deployed = isDeployed(item);
    const disabledForDismantle = isDismantleMode && deployed;
    const isRepresentative = user?.representativeCharacter?.id === item.id;

    return (
      <TouchableOpacity
        style={{
          width: '48%',
          backgroundColor: colors.card,
          borderColor: isRepresentative
            ? colors.gold
            : selectedForDismantle
              ? colors.primary
              : colors.cardBorder,
          borderRadius: radius.md,
          borderWidth: isRepresentative || selectedForDismantle ? 2 : 1,
          opacity: disabledForDismantle ? 0.45 : 1,
          padding: 14,
          alignItems: 'center',
          overflow: 'hidden',
        }}
        accessibilityState={{
          disabled: disabledForDismantle,
          selected: selectedForDismantle,
        }}
        activeOpacity={0.85}
        disabled={disabledForDismantle}
        onPress={() => openCharacterDetail(item)}
        onLongPress={() => handleRepresentative(item)}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: isRepresentative ? colors.gold : grade,
          }}
        />

        {isRepresentative && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              alignItems: 'center',
              zIndex: 2,
            }}
            pointerEvents="none"
          >
            <View
              style={{
                backgroundColor: colors.gold,
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{ color: colors.bg, fontSize: 9, fontWeight: '900' }}
              >
                대표
              </Text>
            </View>
          </View>
        )}

        {isDismantleMode && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: selectedForDismantle
                ? colors.primary
                : colors.divider,
              backgroundColor: selectedForDismantle
                ? colors.primary
                : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: selectedForDismantle ? colors.bg : colors.textMuted,
                fontSize: 11,
                fontWeight: '800',
              }}
            >
              {deployed ? 'X' : selectedForDismantle ? 'V' : ''}
            </Text>
          </View>
        )}

        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            paddingRight: isDismantleMode ? 22 : 0,
          }}
        >
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: `${grade}30`,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: grade }}>
              {GRADE_LABEL[item.grade]}
            </Text>
          </View>
          <Text style={{ fontSize: 9, color: colors.textMuted }}>
            {deployed
              ? `배치됨 #${item.deployedTerritoryId}`
              : TYPE_SHORT[item.type]}
          </Text>
        </View>

        <Image
          source={getCharacterImageSource(item.grade, item.type)}
          style={{
            width: '100%',
            height: 88,
            marginBottom: 8,
            transform: getCharacterImageTransform(item.grade, item.type, 88),
          }}
          resizeMode="contain"
        />

        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}
        >
          {TYPE_LABEL[item.type]}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          {STAT_ROWS.map(row => (
            <View
              key={row.stat}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: colors.textSecondary,
                  fontWeight: '600',
                }}
              >
                {row.shortLabel} {row.getLevel(item)}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: 16,
        paddingTop: insets.top + 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
            캐릭터 보관함
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
            보유 {characters.length}/30 / 스탯 포인트 {user?.statPoints ?? 0}
            {!isDismantleMode ? ' / 길게 눌러 대표 설정' : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: isDismantleMode
                ? colors.dangerDim
                : colors.surface,
              borderColor: isDismantleMode ? colors.danger : colors.divider,
              borderRadius: radius.full,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
            disabled={isDismantling}
            onPress={toggleDismantleMode}
          >
            <Text
              style={{
                color: isDismantleMode ? colors.danger : colors.text,
                fontSize: 13,
                fontWeight: '800',
              }}
            >
              {isDismantleMode ? '취소' : '분해'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              paddingHorizontal: 18,
              paddingVertical: 10,
            }}
            disabled={isDismantleMode}
            onPress={() => navigation.navigate('Gacha')}
          >
            <Text style={{ color: colors.bg, fontSize: 13, fontWeight: '800' }}>
              뽑기
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 40, marginBottom: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, alignItems: 'center' }}
        >
          {SORT_OPTIONS.map(option => {
            const active = sortMode === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={{
                  height: 32,
                  minWidth: 64,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.divider,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                }}
                disabled={isDismantleMode}
                onPress={() => {
                  setSortMode(option.value);
                  if (option.value !== 'type') {
                    setTypeFilter(null);
                  }
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: active ? colors.bg : colors.textSecondary,
                    fontSize: 12,
                    lineHeight: 16,
                    fontWeight: '800',
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {sortMode === 'type' && !isDismantleMode && (
        <View
          style={{
            height: 38,
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {TYPE_FILTER_OPTIONS.map(option => {
            const active = typeFilter === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={{
                  flex: 1,
                  height: 36,
                  backgroundColor: active ? colors.primaryDim : colors.surface,
                  borderColor: active ? colors.primary : colors.divider,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setTypeFilter(option.value)}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: active ? colors.primary : colors.textSecondary,
                    fontSize: 12,
                    lineHeight: 16,
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

      {isDismantleMode && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
            borderRadius: radius.md,
            borderWidth: 1,
            padding: 12,
            marginBottom: 14,
            gap: 10,
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
                style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}
              >
                {selectedDismantleIds.length}/{maxSelectableDismantleCount}{' '}
                선택됨
              </Text>
              <Text
                style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}
              >
                예상 스탯 포인트 {expectedStatPoints}
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor:
                  selectedDismantleIds.length === 0
                    ? colors.divider
                    : colors.danger,
                borderRadius: radius.full,
                minWidth: 92,
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 9,
              }}
              disabled={selectedDismantleIds.length === 0 || isDismantling}
              onPress={confirmDismantle}
            >
              <Text
                style={{
                  color:
                    selectedDismantleIds.length === 0
                      ? colors.textMuted
                      : colors.bg,
                  fontSize: 13,
                  fontWeight: '800',
                }}
              >
                {isDismantling ? '분해 중...' : '선택 분해'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            배치 중인 캐릭터는 분해할 수 없습니다. 대표 캐릭터를 분해하면 대표
            설정도 함께 해제됩니다. 최소 1개의 캐릭터는 남아 있어야 합니다.
          </Text>
        </View>
      )}

      {isLoading && characters.length === 0 ? (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sortedCharacters}
          keyExtractor={item => `${item.id}`}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 20,
          }}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                minHeight: 360,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: colors.textSecondary,
                  fontWeight: '600',
                }}
              >
                보유 캐릭터가 없습니다
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textMuted,
                  marginTop: 4,
                }}
              >
                뽑기로 캐릭터를 획득하세요.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <Modal
        transparent
        visible={detailCharacter !== null}
        animationType="fade"
        onRequestClose={() => setDetailCharacter(null)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.58)',
            }}
            onPress={() => setDetailCharacter(null)}
          />
          <View
            pointerEvents="box-none"
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: 18,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
            }}
          >
          {detailCharacter && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.cardBorder,
                borderRadius: radius.xl,
                borderWidth: 1,
                overflow: 'hidden',
              }}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: windowHeight - insets.top - insets.bottom - 60 }}
                contentContainerStyle={{ padding: 18 }}
              >
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <Image
                    source={getCharacterImageSource(
                      detailCharacter.grade,
                      detailCharacter.type,
                    )}
                    style={{
                      width: '100%',
                      height: 240,
                      transform: getCharacterImageTransform(
                        detailCharacter.grade,
                        detailCharacter.type,
                        240,
                      ),
                    }}
                    resizeMode="contain"
                  />
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 22,
                        fontWeight: '900',
                      }}
                    >
                      {detailCharacter.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      {TYPE_LABEL[detailCharacter.type]} 캐릭터
                    </Text>
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 12,
                        fontWeight: '700',
                        marginTop: 8,
                      }}
                    >
                      캐릭터 Lv. {detailCharacter.level ?? '-'}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: `${
                        gradeColor[detailCharacter.grade] ?? colors.gradeCommon
                      }24`,
                      borderRadius: radius.full,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          gradeColor[detailCharacter.grade] ??
                          colors.gradeCommon,
                        fontSize: 12,
                        fontWeight: '900',
                      }}
                    >
                      {GRADE_LABEL[detailCharacter.grade]}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: radius.sm,
                    marginTop: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: '800',
                      }}
                    >
                      경험치
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {detailCharacter.experience == null
                        ? '-'
                        : detailCharacter.nextLevelExperience === null
                          ? 'MAX'
                          : `${detailCharacter.experience} / ${detailCharacter.nextLevelExperience}`}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 9,
                      backgroundColor: colors.divider,
                      borderRadius: radius.full,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${getExperienceProgress(detailCharacter) * 100}%`,
                        height: '100%',
                        backgroundColor: colors.primary,
                        borderRadius: radius.full,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 11,
                      marginTop: 7,
                    }}
                  >
                    {detailCharacter.nextLevelExperience === null
                      ? '최대 레벨입니다.'
                      : detailCharacter.experience == null
                        ? '-'
                        : `레벨업까지 ${
                            detailCharacter.nextLevelExperience -
                            detailCharacter.experience
                          } EXP 남음`}
                  </Text>
                </View>

                {isDeployed(detailCharacter) && (
                  <View
                    style={{
                      backgroundColor: colors.primaryDim,
                      borderRadius: radius.sm,
                      marginTop: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 13,
                        fontWeight: '800',
                      }}
                    >
                      영토 #{detailCharacter.deployedTerritoryId}에 배치됨
                    </Text>
                  </View>
                )}

                <View style={{ marginTop: 14 }}>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    스탯 포인트 {user?.statPoints ?? 0}
                  </Text>
                </View>

                <View style={{ gap: 8, marginTop: 18 }}>
                  {STAT_ROWS.map(row => {
                    const isUpgrading = upgradingStat === row.stat;
                    return (
                      <View
                        key={row.stat}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: colors.card,
                          borderRadius: radius.sm,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <View>
                          <Text
                            style={{
                              color: colors.text,
                              fontSize: 14,
                              fontWeight: '800',
                            }}
                          >
                            {row.label}
                          </Text>
                          <Text
                            style={{
                              color: colors.textMuted,
                              fontSize: 12,
                              marginTop: 2,
                            }}
                          >
                            Lv. {row.getLevel(detailCharacter)} / 스탯 포인트
                            1개
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{
                            backgroundColor:
                              (user?.statPoints ?? 0) < 1
                                ? colors.card
                                : colors.surface,
                            borderColor: colors.divider,
                            borderRadius: radius.full,
                            borderWidth: 1,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                          }}
                          disabled={isUpgrading || (user?.statPoints ?? 0) < 1}
                          onPress={() =>
                            handleUpgrade(detailCharacter, row.stat)
                          }
                        >
                          <Text
                            style={{
                              color:
                                (user?.statPoints ?? 0) < 1
                                  ? colors.textMuted
                                  : colors.textSecondary,
                              fontSize: 12,
                              fontWeight: '800',
                            }}
                          >
                            {isUpgrading ? '강화 중...' : '강화'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderColor: colors.divider,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      paddingVertical: 13,
                      alignItems: 'center',
                    }}
                    onPress={() => setDetailCharacter(null)}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 14,
                        fontWeight: '800',
                      }}
                    >
                      닫기
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor:
                        detailCharacter.type === 'attack'
                          ? colors.divider
                          : colors.primary,
                      borderRadius: radius.md,
                      paddingVertical: 13,
                      alignItems: 'center',
                    }}
                    disabled={detailCharacter.type === 'attack'}
                    onPress={() => openDeploy(detailCharacter)}
                  >
                    <Text
                      style={{
                        color:
                          detailCharacter.type === 'attack'
                            ? colors.textMuted
                            : colors.bg,
                        fontSize: 14,
                        fontWeight: '900',
                      }}
                    >
                      {detailCharacter.type === 'attack' ? '배치 불가' : '배치'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={selected !== null}
        animationType="slide"
        onRequestClose={() => !isDeploying && setSelected(null)}
      >
        <Pressable
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          onPress={() => !isDeploying && setSelected(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: 20,
              gap: 8,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.divider,
                alignSelf: 'center',
                marginBottom: 8,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: colors.text,
                  }}
                >
                  {selected?.name}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    marginTop: 4,
                  }}
                >
                  {selected
                    ? `${TYPE_LABEL[selected.type]} / ${
                        GRADE_LABEL[selected.grade]
                      }`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.divider,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
                disabled={isDeploying}
                onPress={() => setSelected(null)}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: '800',
                    fontSize: 12,
                  }}
                >
                  닫기
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              배치할 영토를 선택하세요.
            </Text>

            {selected?.deployedTerritoryId !== null &&
              selected?.deployedTerritoryId !== undefined && (
                <View
                  style={{
                    backgroundColor: colors.primaryDim,
                    borderRadius: radius.sm,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: '800',
                      fontSize: 13,
                    }}
                  >
                    현재 영토 #{selected.deployedTerritoryId}에 배치 중
                  </Text>
                </View>
              )}

            {selected?.isDeployed && (
              <TouchableOpacity
                style={{
                  backgroundColor: colors.dangerDim,
                  borderRadius: radius.sm,
                  paddingVertical: 12,
                  alignItems: 'center',
                  marginTop: 4,
                }}
                disabled={isDeploying}
                onPress={() => submitDeploy(null)}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: '700',
                    fontSize: 14,
                  }}
                >
                  배치 해제
                </Text>
              </TouchableOpacity>
            )}

            {territories.length === 0 ? (
              <Text
                style={{
                  textAlign: 'center',
                  color: colors.textMuted,
                  paddingVertical: 24,
                }}
              >
                보유한 영토가 없습니다
              </Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 340 }}
                showsVerticalScrollIndicator={false}
              >
                {territories.map(territory => {
                  const disabled =
                    deployedIds.has(territory.id) &&
                    territory.id !== selected?.deployedTerritoryId;
                  const current =
                    territory.id === selected?.deployedTerritoryId;
                  return (
                    <TouchableOpacity
                      key={territory.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: colors.card,
                        borderRadius: radius.sm,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        marginBottom: 8,
                        opacity: disabled ? 0.35 : 1,
                        borderColor: current ? colors.primary : colors.card,
                        borderWidth: current ? 1 : 0,
                      }}
                      disabled={disabled || isDeploying}
                      onPress={() => submitDeploy(territory.id)}
                    >
                      <View>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: colors.text,
                          }}
                        >
                          {territory.name ?? `영토 #${territory.id}`}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.textMuted,
                            marginTop: 2,
                          }}
                        >
                          {formatArea(territory.areaSqm)} / 점령률{' '}
                          {territory.occupationRate}%
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: disabled ? colors.textMuted : colors.primary,
                          fontWeight: '700',
                          fontSize: 13,
                        }}
                      >
                        {disabled ? '사용 중' : current ? '현재 배치' : '선택'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
