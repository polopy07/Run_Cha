import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CharacterStackParamList } from '../navigation/CharacterStack';
import { deployCharacter } from '../api/character';
import { getMyTerritories, type Territory } from '../api/territory';
import useCharacterStore, { type Character } from '../store/characterStore';

type Nav = StackNavigationProp<CharacterStackParamList, 'Storage'>;

const GRADE_COLOR: Record<string, string> = {
  common: '#95A5A6',
  rare: '#3498DB',
  epic: '#9B59B6',
  legendary: '#F39C12',
};

const GRADE_LABEL: Record<string, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

const TYPE_ICON: Record<string, string> = {
  attack: 'ATK',
  defense: 'DEF',
  buff: 'BUF',
};

const TYPE_LABEL: Record<string, string> = {
  attack: 'Attack',
  defense: 'Defense',
  buff: 'Buff',
};

function formatArea(areaSqm: number) {
  return `${Math.round(areaSqm).toLocaleString()} sqm`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const noop = () => undefined;

export function StorageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { characters, isLoading, fetchCharacters, updateCharacter } =
    useCharacterStore();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(
    null,
  );

  const deployedTerritoryIds = useMemo(
    () =>
      new Set(
        characters
          .map((character) => character.deployedTerritoryId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    [characters],
  );

  const load = useCallback(async () => {
    const [charactersResult, territoriesResult] = await Promise.allSettled([
      fetchCharacters(),
      getMyTerritories(),
    ]);

    if (charactersResult.status === 'rejected') {
      setTerritories([]);
      throw charactersResult.reason;
    }

    if (territoriesResult.status === 'rejected') {
      setTerritories([]);
      throw territoriesResult.reason;
    }

    setTerritories(territoriesResult.value);
  }, [fetchCharacters]);

  useEffect(() => {
    load().catch((error: unknown) => {
      Alert.alert(
        'Load failed',
        getErrorMessage(error, 'Could not load storage data.'),
      );
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (error: unknown) {
      Alert.alert(
        'Load failed',
        getErrorMessage(error, 'Could not load storage data.'),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const closeDeployModal = useCallback(() => {
    if (!isDeploying) {
      setSelectedCharacter(null);
    }
  }, [isDeploying]);

  const openDeployModal = (character: Character) => {
    if (character.type === 'attack') {
      Alert.alert(
        'Cannot deploy',
        'Only defense and buff characters can be deployed to territories.',
      );
      return;
    }

    setSelectedCharacter(character);
  };

  const submitDeploy = async (territoryId: number | null) => {
    if (!selectedCharacter) return;

    setIsDeploying(true);
    try {
      const updatedCharacter = await deployCharacter(
        selectedCharacter.id,
        territoryId,
      );
      updateCharacter(updatedCharacter);
      setSelectedCharacter(null);
    } catch (error: unknown) {
      Alert.alert(
        'Deploy failed',
        getErrorMessage(error, 'Deploy request failed.'),
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const renderItem = ({ item }: { item: Character }) => {
    const gradeColor = GRADE_COLOR[item.grade] ?? '#95A5A6';
    const isDeployable = item.type !== 'attack';

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: gradeColor }]}
        activeOpacity={0.85}
        onPress={() => openDeployModal(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
            <Text style={styles.gradeText}>
              {GRADE_LABEL[item.grade] ?? item.grade}
            </Text>
          </View>
          <Text style={styles.deployText}>
            {item.isDeployed
              ? `Deployed #${item.deployedTerritoryId}`
              : isDeployable
                ? 'Not deployed'
                : 'Cannot deploy'}
          </Text>
        </View>

        <Text style={styles.cardIcon}>{TYPE_ICON[item.type] ?? 'UNK'}</Text>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.characterType}>
          {TYPE_LABEL[item.type] ?? item.type}
        </Text>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>ATK {item.attackLv}</Text>
          <Text style={styles.stat}>DEF {item.defenseLv}</Text>
          <Text style={styles.stat}>SPD {item.speedLv}</Text>
          <Text style={styles.stat}>PT {item.pointLv}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Character Storage</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{characters.length} owned</Text>
          <TouchableOpacity
            style={styles.gachaBtn}
            onPress={() => navigation.navigate('Gacha')}
          >
            <Text style={styles.gachaBtnIcon}>+</Text>
            <Text style={styles.gachaBtnText}>Gacha</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && characters.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2ECC71" />
        </View>
      ) : characters.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>0</Text>
          <Text style={styles.emptyText}>No characters owned</Text>
          <Text style={styles.emptySub}>Draw characters from gacha.</Text>
        </View>
      ) : (
        <FlatList
          data={characters}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#2ECC71"
            />
          }
        />
      )}

      <Modal
        transparent
        visible={selectedCharacter !== null}
        animationType="fade"
        onRequestClose={closeDeployModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDeployModal}>
          <Pressable style={styles.modalCard} onPress={noop}>
            <Text style={styles.modalTitle}>{selectedCharacter?.name}</Text>
            <Text style={styles.modalSub}>Select a territory to deploy.</Text>

            {selectedCharacter?.isDeployed && (
              <TouchableOpacity
                style={[styles.territoryOption, styles.undeployOption]}
                disabled={isDeploying}
                onPress={() => submitDeploy(null)}
              >
                <Text style={styles.undeployText}>Undeploy</Text>
              </TouchableOpacity>
            )}

            {territories.length === 0 ? (
              <Text style={styles.noTerritoryText}>No territories owned</Text>
            ) : (
              <ScrollView
                style={styles.territoryList}
                showsVerticalScrollIndicator={false}
              >
                {territories.map((territory) => {
                  const disabled =
                    deployedTerritoryIds.has(territory.id) &&
                    territory.id !== selectedCharacter?.deployedTerritoryId;

                  return (
                    <TouchableOpacity
                      key={territory.id}
                      style={[
                        styles.territoryOption,
                        disabled && styles.disabledOption,
                      ]}
                      disabled={disabled || isDeploying}
                      onPress={() => submitDeploy(territory.id)}
                    >
                      <View>
                        <Text style={styles.territoryTitle}>
                          Territory #{territory.id}
                        </Text>
                        <Text style={styles.territoryMeta}>
                          {formatArea(territory.areaSqm)} / Occupation{' '}
                          {territory.occupationRate}%
                        </Text>
                      </View>
                      <Text style={styles.territoryStatus}>
                        {disabled ? 'In use' : 'Select'}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { fontSize: 13, color: '#888' },
  gachaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2ECC71',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  gachaBtnIcon: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  gachaBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  list: { paddingBottom: 20 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  card: {
    width: '48%',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
  },
  cardHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gradeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  deployText: { fontSize: 10, color: '#666' },
  cardIcon: { fontSize: 18, marginBottom: 6, fontWeight: 'bold' },
  cardName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  characterType: { fontSize: 12, color: '#777', marginBottom: 8 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  stat: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: 11,
    color: '#666',
    backgroundColor: '#ECECEC',
    borderRadius: 6,
    paddingVertical: 3,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#888', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#aaa' },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 18,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  modalSub: { fontSize: 13, color: '#777', marginBottom: 4 },
  territoryList: { maxHeight: 360 },
  territoryOption: {
    minHeight: 62,
    borderRadius: 8,
    backgroundColor: '#F4F6F7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabledOption: { opacity: 0.45 },
  undeployOption: { backgroundColor: '#FDEDEC' },
  undeployText: { color: '#E74C3C', fontWeight: 'bold' },
  territoryTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  territoryMeta: { marginTop: 4, fontSize: 12, color: '#777' },
  territoryStatus: { color: '#2ECC71', fontWeight: 'bold' },
  noTerritoryText: { paddingVertical: 24, textAlign: 'center', color: '#888' },
});
