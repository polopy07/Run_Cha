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
import { radius } from '../constants/theme';
import { getCharacterImageSource } from '../assets/characters/characterImages';

type Nav = StackNavigationProp<CharacterStackParamList, 'Storage'>;

const GRADE_LABEL: Record<Character['grade'], string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGEND',
};

const TYPE_LABEL: Record<Character['type'], string> = {
  attack: 'Attack',
  defense: 'Defense',
  buff: 'Buff',
};

const TYPE_SHORT: Record<Character['type'], string> = {
  attack: 'ATK',
  defense: 'DEF',
  buff: 'BUF',
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
  return `${Math.round(sqm).toLocaleString()} sqm`;
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
  const [detailCharacter, setDetailCharacter] = useState<Character | null>(null);
  const [isDismantleMode, setIsDismantleMode] = useState(false);
  const [selectedDismantleIds, setSelectedDismantleIds] = useState<number[]>([]);
  const [isDismantling, setIsDismantling] = useState(false);

  const deployedIds = useMemo(
    () => new Set(
      characters
        .map(character => character.deployedTerritoryId)
        .filter((id): id is number => typeof id === 'number'),
    ),
    [characters],
  );

  const selectedDismantleCharacters = useMemo(
    () => characters.filter(character => selectedDismantleIds.includes(character.id)),
    [characters, selectedDismantleIds],
  );

  const dismantlableCharacterCount = useMemo(
    () => characters.filter(character => !isDeployed(character)).length,
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
      Alert.alert('Load failed', getErr(error, 'Unable to load character data.'));
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (error) {
      Alert.alert('Load failed', getErr(error, 'Unable to load character data.'));
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

  const toggleDismantleSelection = useCallback((character: Character) => {
    if (isDeployed(character)) {
      Alert.alert('Cannot dismantle', 'Deployed characters cannot be dismantled.');
      return;
    }

    setSelectedDismantleIds(current => {
      if (current.includes(character.id)) {
        return current.filter(id => id !== character.id);
      }

      if (characters.length - (current.length + 1) < 1) {
        Alert.alert('Cannot dismantle', 'At least one character must remain.');
        return current;
      }

      if (current.length >= DISMANTLE_MAX_COUNT) {
        Alert.alert('Selection limit', `You can dismantle up to ${DISMANTLE_MAX_COUNT} characters at once.`);
        return current;
      }

      return [...current, character.id];
    });
  }, [characters.length]);

  const openCharacterDetail = useCallback((character: Character) => {
    if (isDismantleMode) {
      toggleDismantleSelection(character);
      return;
    }

    setDetailCharacter(character);
  }, [isDismantleMode, toggleDismantleSelection]);

  const openDeploy = useCallback((character: Character) => {
    if (character.type === 'attack') {
      Alert.alert('Cannot deploy', 'Only defense and buff characters can be deployed.');
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
      Alert.alert('Deploy failed', getErr(error, 'Please try again.'));
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
        'Dismantled',
        `${result.dismantledCount} characters dismantled. +${result.earnedStatPoints} stat points.`,
      );
    } catch (error) {
      Alert.alert('Dismantle failed', getErr(error, 'Please try again.'));
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
      Alert.alert('Select characters', 'Choose characters to dismantle.');
      return;
    }

    if (characters.length - selectedDismantleIds.length < 1) {
      Alert.alert('Cannot dismantle', 'At least one character must remain.');
      return;
    }

    Alert.alert(
      'Dismantle characters',
      `Dismantle ${selectedDismantleIds.length} characters for ${expectedStatPoints} stat points?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismantle',
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

  const showUpgradePending = useCallback(() => {
    Alert.alert('Coming soon', 'Stat upgrade UI will be connected in the next task.');
  }, []);

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
        onPress={() => openCharacterDetail(item)}
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
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: `${grade}30` }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: grade }}>{GRADE_LABEL[item.grade]}</Text>
          </View>
          <Text style={{ fontSize: 9, color: colors.textMuted }}>
            {deployed ? `Deployed #${item.deployedTerritoryId}` : TYPE_SHORT[item.type]}
          </Text>
        </View>

        <Image
          source={getCharacterImageSource(item.grade, item.type)}
          style={{ width: '100%', height: 88, marginBottom: 8 }}
          resizeMode="contain"
        />

        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>{TYPE_LABEL[item.type]}</Text>

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
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Character Storage</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {characters.length}/30 owned / Stat points {user?.statPoints ?? 0}
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
              {isDismantleMode ? 'Cancel' : 'Dismantle'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 10 }}
            disabled={isDismantleMode}
            onPress={() => navigation.navigate('Gacha')}
          >
            <Text style={{ color: colors.bg, fontSize: 13, fontWeight: '800' }}>Gacha</Text>
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
                {selectedDismantleIds.length}/{maxSelectableDismantleCount} selected
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                Expected stat points {expectedStatPoints}
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
                {isDismantling ? 'Dismantling...' : 'Dismantle selected'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            Deployed characters cannot be dismantled. At least one character must remain.
          </Text>
        </View>
      )}

      {isLoading && characters.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : characters.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '600' }}>No characters</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>Draw characters from gacha.</Text>
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

      <Modal
        transparent
        visible={detailCharacter !== null}
        animationType="fade"
        onRequestClose={() => setDetailCharacter(null)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 18 }}
          onPress={() => setDetailCharacter(null)}
        >
          {detailCharacter && (
            <Pressable
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.cardBorder,
                borderRadius: radius.xl,
                borderWidth: 1,
                padding: 18,
                maxHeight: '88%',
              }}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <Image
                    source={getCharacterImageSource(detailCharacter.grade, detailCharacter.type)}
                    style={{ width: '100%', height: 240 }}
                    resizeMode="contain"
                  />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>
                      {detailCharacter.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                      {TYPE_LABEL[detailCharacter.type]} character
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: `${gradeColor[detailCharacter.grade] ?? colors.gradeCommon}24`,
                      borderRadius: radius.full,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: gradeColor[detailCharacter.grade] ?? colors.gradeCommon,
                        fontSize: 12,
                        fontWeight: '900',
                      }}
                    >
                      {GRADE_LABEL[detailCharacter.grade]}
                    </Text>
                  </View>
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
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
                      Deployed to territory #{detailCharacter.deployedTerritoryId}
                    </Text>
                  </View>
                )}

                <View style={{ gap: 8, marginTop: 18 }}>
                  {[
                    ['Attack', detailCharacter.attackLv],
                    ['Defense', detailCharacter.defenseLv],
                    ['Speed', detailCharacter.speedLv],
                    ['Point', detailCharacter.pointLv],
                  ].map(([label, level]) => (
                    <View
                      key={label}
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
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{label}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Lv. {level}</Text>
                      </View>
                      <TouchableOpacity
                        style={{
                          backgroundColor: colors.surface,
                          borderColor: colors.divider,
                          borderRadius: radius.full,
                          borderWidth: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                        }}
                        onPress={showUpgradePending}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '800' }}>Upgrade</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
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
                    <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '800' }}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: detailCharacter.type === 'attack' ? colors.divider : colors.primary,
                      borderRadius: radius.md,
                      paddingVertical: 13,
                      alignItems: 'center',
                    }}
                    disabled={detailCharacter.type === 'attack'}
                    onPress={() => openDeploy(detailCharacter)}
                  >
                    <Text style={{ color: detailCharacter.type === 'attack' ? colors.textMuted : colors.bg, fontSize: 14, fontWeight: '900' }}>
                      {detailCharacter.type === 'attack' ? 'Cannot deploy' : 'Deploy'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <Modal transparent visible={selected !== null} animationType="slide" onRequestClose={() => !isDeploying && setSelected(null)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => !isDeploying && setSelected(null)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, gap: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider, alignSelf: 'center', marginBottom: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{selected?.name}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Select a territory to deploy.</Text>

            {selected?.isDeployed && (
              <TouchableOpacity
                style={{ backgroundColor: colors.dangerDim, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
                disabled={isDeploying}
                onPress={() => submitDeploy(null)}
              >
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 14 }}>Withdraw</Text>
              </TouchableOpacity>
            )}

            {territories.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: 24 }}>No owned territories</Text>
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
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                          {territory.name ?? `Territory #${territory.id}`}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                          {formatArea(territory.areaSqm)} / ownership {territory.occupationRate}%
                        </Text>
                      </View>
                      <Text style={{ color: disabled ? colors.textMuted : colors.primary, fontWeight: '700', fontSize: 13 }}>
                        {disabled ? 'Used' : 'Select'}
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
