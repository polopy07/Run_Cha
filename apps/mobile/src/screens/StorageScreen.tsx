import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CharacterStackParamList } from '../navigation/CharacterStack';
import { deployCharacter, dismantleCharacters } from '../api/character';
import { getMyTerritories, type Territory } from '../api/territory';
import useCharacterStore, { type Character } from '../store/characterStore';
import useAuthStore from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { radius, GRADE_LABEL } from '../constants/theme';

type Nav = StackNavigationProp<CharacterStackParamList, 'Storage'>;

const TYPE_LABEL: Record<Character['type'], string> = {
  attack: 'ATK',
  defense: 'DEF',
  buff: 'BUF',
};

const TYPE_FULL: Record<Character['type'], string> = {
  attack: '공격',
  defense: '수비',
  buff: '버프',
};

// Keep in sync with apps/server/src/characters/dto/dismantle-characters.dto.ts.
const DISMANTLE_MAX_COUNT = 29;

const DISMANTLE_REWARD_BY_GRADE: Record<Character['grade'], number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function formatArea(sqm: number) {
  return `${Math.round(sqm).toLocaleString()} m²`;
}

function getErr(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isDeployed(character: Character) {
  return character.isDeployed || character.deployedTerritoryId !== null;
}

export function StorageScreen() {
  const { colors, gradeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {
    characters,
    isLoading,
    fetchCharacters,
    updateCharacter,
  } = useCharacterStore();
  const user = useAuthStore(state => state.user);
  const fetchMe = useAuthStore(state => state.fetchMe);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);
  const [isDismantleMode, setIsDismantleMode] = useState(false);
  const [selectedDismantleIds, setSelectedDismantleIds] = useState<number[]>([]);
  const [isDismantling, setIsDismantling] = useState(false);

  const deployedIds = useMemo(
    () => new Set(
      characters
        .map((character) => character.deployedTerritoryId)
        .filter((id): id is number => typeof id === 'number'),
    ),
    [characters],
  );

  const selectedDismantleCharacters = useMemo(
    () => characters.filter((character) => selectedDismantleIds.includes(character.id)),
    [characters, selectedDismantleIds],
  );

  const dismantlableCharacterCount = useMemo(
    () => characters.filter((character) => !isDeployed(character)).length,
    [characters],
  );

  const expectedStatPoints = useMemo(
    () => selectedDismantleCharacters.reduce(
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

  const load = useCallback(async () => {
    const [characterResult, territoryResult] = await Promise.allSettled([
      fetchCharacters(),
      getMyTerritories(),
    ]);

    if (characterResult.status === 'rejected') {
      setTerritories([]);
      throw characterResult.reason;
    }

    if (territoryResult.status === 'rejected') {
      setTerritories([]);
      throw territoryResult.reason;
    }

    setTerritories(territoryResult.value);
  }, [fetchCharacters]);

  useEffect(() => {
    load().catch(error => {
      Alert.alert('로드 실패', getErr(error, '데이터를 불러오지 못했습니다.'));
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (error) {
      Alert.alert('로드 실패', getErr(error, '데이터를 불러오지 못했습니다.'));
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
    setSelectedDismantleIds([]);
    setIsDismantleMode(current => !current);
  }, []);

  const toggleDismantleSelection = useCallback((character: Character) => {
    if (isDeployed(character)) {
      Alert.alert('분해 불가', '배치 중인 캐릭터는 분해할 수 없습니다.');
      return;
    }

    setSelectedDismantleIds(current => {
      if (current.includes(character.id)) {
        return current.filter(id => id !== character.id);
      }

      if (characters.length - (current.length + 1) < 1) {
        Alert.alert('분해 불가', '캐릭터는 최소 1개 이상 보유해야 합니다.');
        return current;
      }

      if (current.length >= DISMANTLE_MAX_COUNT) {
        Alert.alert('선택 제한', `한 번에 최대 ${DISMANTLE_MAX_COUNT}개까지 분해할 수 있습니다.`);
        return current;
      }

      return [...current, character.id];
    });
  }, [characters.length]);

  const openDeploy = useCallback((character: Character) => {
    if (isDismantleMode) {
      toggleDismantleSelection(character);
      return;
    }

    if (character.type === 'attack') {
      Alert.alert('배치 불가', '수비/버프 캐릭터만 영토에 배치할 수 있습니다.');
      return;
    }

    setSelected(character);
  }, [isDismantleMode, toggleDismantleSelection]);

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
      resetDismantleMode();
      await Promise.all([fetchCharacters(), fetchMe()]);
      Alert.alert(
        '분해 완료',
        `${result.dismantledCount}개를 분해하고 스탯 포인트 ${result.earnedStatPoints}개를 획득했습니다.`,
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
      Alert.alert('선택 필요', '분해할 캐릭터를 선택해주세요.');
      return;
    }

    if (characters.length - selectedDismantleIds.length < 1) {
      Alert.alert('분해 불가', '캐릭터는 최소 1개 이상 보유해야 합니다.');
      return;
    }

    Alert.alert(
      '캐릭터 분해',
      `${selectedDismantleIds.length}개를 분해하고 스탯 포인트 ${expectedStatPoints}개를 획득합니다.`,
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
    selectedDismantleIds.length,
  ]);

  const renderItem = ({ item }: { item: Character }) => {
    const grade = gradeColor[item.grade] ?? colors.gradeCommon;
    const selectedForDismantle = selectedDismantleIds.includes(item.id);
    const deployed = isDeployed(item);
    const disabledForDismantle = isDismantleMode && deployed;

    return (
      <TouchableOpacity
        style={{
          width: '48%',
          backgroundColor: colors.card,
          borderColor: selectedForDismantle ? colors.primary : colors.cardBorder,
          borderRadius: radius.md,
          borderWidth: selectedForDismantle ? 2 : 1,
          opacity: disabledForDismantle ? 0.45 : 1,
          padding: 14,
          alignItems: 'center',
          overflow: 'hidden',
        }}
        accessibilityState={{ disabled: disabledForDismantle, selected: selectedForDismantle }}
        activeOpacity={0.85}
        disabled={disabledForDismantle}
        onPress={() => openDeploy(item)}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: grade,
          }}
        />
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
              borderColor: selectedForDismantle ? colors.primary : colors.divider,
              backgroundColor: selectedForDismantle ? colors.primary : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: selectedForDismantle ? colors.bg : colors.textMuted, fontSize: 11, fontWeight: '800' }}>
              {deployed ? '×' : selectedForDismantle ? '✓' : ''}
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
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: `${grade}30` }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: grade }}>{GRADE_LABEL[item.grade]}</Text>
          </View>
          <Text style={{ fontSize: 9, color: colors.textMuted }}>
            {deployed ? `배치중 #${item.deployedTerritoryId}` : item.type !== 'attack' ? '미배치' : '공격'}
          </Text>
        </View>

        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
            backgroundColor: `${grade}20`,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: grade }}>{TYPE_LABEL[item.type]}</Text>
        </View>

        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>{TYPE_FULL[item.type]}</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
          {['ATK', 'DEF', 'SPD', 'PT'].map((label, index) => (
            <View key={label} style={{ backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>
                {label} {[item.attackLv, item.defenseLv, item.speedLv, item.pointLv][index]}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>캐릭터 보관함</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {characters.length}개 보유 · 스탯 포인트 {user?.statPoints ?? 0}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: isDismantleMode ? colors.dangerDim : colors.surface,
              borderColor: isDismantleMode ? colors.danger : colors.divider,
              borderRadius: radius.full,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
            disabled={isDismantling}
            onPress={toggleDismantleMode}
          >
            <Text style={{ color: isDismantleMode ? colors.danger : colors.text, fontSize: 13, fontWeight: '800' }}>
              {isDismantleMode ? '취소' : '분해'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 10 }}
            disabled={isDismantleMode}
            onPress={() => navigation.navigate('Gacha')}
          >
            <Text style={{ color: colors.bg, fontSize: 13, fontWeight: '800' }}>뽑기</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                {selectedDismantleIds.length}/{maxSelectableDismantleCount}개 선택
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                예상 획득 스탯 포인트 {expectedStatPoints}
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: selectedDismantleIds.length === 0 ? colors.divider : colors.danger,
                borderRadius: radius.full,
                paddingHorizontal: 16,
                paddingVertical: 9,
              }}
              disabled={selectedDismantleIds.length === 0 || isDismantling}
              onPress={confirmDismantle}
            >
              <Text style={{ color: selectedDismantleIds.length === 0 ? colors.textMuted : colors.bg, fontSize: 13, fontWeight: '800' }}>
                {isDismantling ? '분해 중' : '선택 분해'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            배치 중인 캐릭터는 분해할 수 없고, 캐릭터는 최소 1개 이상 보유해야 합니다.
          </Text>
        </View>
      )}

      {isLoading && characters.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : characters.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '600' }}>보유 캐릭터 없음</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>뽑기에서 캐릭터를 획득해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={characters}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      <Modal transparent visible={selected !== null} animationType="slide" onRequestClose={() => !isDeploying && setSelected(null)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => !isDeploying && setSelected(null)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, gap: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider, alignSelf: 'center', marginBottom: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{selected?.name}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>배치할 영토를 선택하세요</Text>

            {selected?.isDeployed && (
              <TouchableOpacity
                style={{ backgroundColor: colors.dangerDim, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
                disabled={isDeploying}
                onPress={() => submitDeploy(null)}
              >
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 14 }}>배치 해제</Text>
              </TouchableOpacity>
            )}

            {territories.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: 24 }}>보유 영토가 없습니다</Text>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {territories.map((territory) => {
                  const disabled = deployedIds.has(territory.id) && territory.id !== selected?.deployedTerritoryId;
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
                      }}
                      disabled={disabled || isDeploying}
                      onPress={() => submitDeploy(territory.id)}
                    >
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>영토 #{territory.id}</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                          {formatArea(territory.areaSqm)} · 점유 {territory.occupationRate}%
                        </Text>
                      </View>
                      <Text style={{ color: disabled ? colors.textMuted : colors.primary, fontWeight: '700', fontSize: 13 }}>
                        {disabled ? '사용중' : '선택'}
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
