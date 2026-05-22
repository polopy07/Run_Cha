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

const GRADE_COLOR: Record<Character['grade'], string> = {
  common: '#95A5A6',
  rare: '#3498DB',
  epic: '#9B59B6',
  legendary: '#F39C12',
};

const GRADE_LABEL: Record<Character['grade'], string> = {
  common: '일반',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
};

const TYPE_ICON: Record<Character['type'], string> = {
  attack: '⚔️',
  defense: '🛡️',
  buff: '✨',
};

const TYPE_LABEL: Record<Character['type'], string> = {
  attack: '공격형',
  defense: '수비형',
  buff: '버프형',
};

function formatArea(areaSqm: number) {
  return `${Math.round(areaSqm).toLocaleString()}㎡`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function StorageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { characters, isLoading, fetchCharacters } = useCharacterStore();
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
    await Promise.all([
      fetchCharacters(),
      getMyTerritories().then(setTerritories),
    ]);
  }, [fetchCharacters]);

  useEffect(() => {
    load().catch((error: unknown) => {
      Alert.alert(
        '조회 실패',
        getErrorMessage(error, '정보를 불러오지 못했습니다.'),
      );
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } catch (error: unknown) {
      Alert.alert(
        '조회 실패',
        getErrorMessage(error, '정보를 불러오지 못했습니다.'),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const openDeployModal = (character: Character) => {
    if (character.type === 'attack') {
      Alert.alert('배치 불가', '수비형과 버프형 캐릭터만 영토에 배치할 수 있습니다.');
      return;
    }

    setSelectedCharacter(character);
  };

  const submitDeploy = async (territoryId: number | null) => {
    if (!selectedCharacter) return;

    setIsDeploying(true);
    try {
      await deployCharacter(selectedCharacter.id, territoryId);
      await load();
      setSelectedCharacter(null);
    } catch (error: unknown) {
      Alert.alert(
        '배치 실패',
        getErrorMessage(error, '배치 요청에 실패했습니다.'),
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const renderItem = ({ item }: { item: Character }) => {
    const gradeColor = GRADE_COLOR[item.grade];
    const isDeployable = item.type !== 'attack';

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor: gradeColor }]}
        activeOpacity={0.85}
        onPress={() => openDeployModal(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
            <Text style={styles.gradeText}>{GRADE_LABEL[item.grade]}</Text>
          </View>
          <Text style={styles.deployText}>
            {item.isDeployed
              ? `배치됨 #${item.deployedTerritoryId}`
              : isDeployable
                ? '미배치'
                : '배치 불가'}
          </Text>
        </View>

        <Text style={styles.cardIcon}>{TYPE_ICON[item.type]}</Text>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.characterType}>{TYPE_LABEL[item.type]}</Text>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>공 {item.attackLv}</Text>
          <Text style={styles.stat}>방 {item.defenseLv}</Text>
          <Text style={styles.stat}>속 {item.speedLv}</Text>
          <Text style={styles.stat}>포 {item.pointLv}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>캐릭터 보관함</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{characters.length}마리</Text>
          <TouchableOpacity
            style={styles.gachaBtn}
            onPress={() => navigation.navigate('Gacha')}
          >
            <Text style={styles.gachaBtnIcon}>🎰</Text>
            <Text style={styles.gachaBtnText}>뽑기</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && characters.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2ECC71" />
        </View>
      ) : characters.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>보유 캐릭터가 없습니다</Text>
          <Text style={styles.emptySub}>뽑기로 캐릭터를 획득해보세요</Text>
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
        onRequestClose={() => setSelectedCharacter(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedCharacter(null)}
        >
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedCharacter?.name}</Text>
            <Text style={styles.modalSub}>배치할 내 영토를 선택하세요</Text>

            {selectedCharacter?.isDeployed && (
              <TouchableOpacity
                style={[styles.territoryOption, styles.undeployOption]}
                disabled={isDeploying}
                onPress={() => submitDeploy(null)}
              >
                <Text style={styles.undeployText}>배치 회수</Text>
              </TouchableOpacity>
            )}

            {territories.length === 0 ? (
              <Text style={styles.noTerritoryText}>보유 영토가 없습니다</Text>
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
                          영토 #{territory.id}
                        </Text>
                        <Text style={styles.territoryMeta}>
                          {formatArea(territory.areaSqm)} · 점령률{' '}
                          {territory.occupationRate}%
                        </Text>
                      </View>
                      <Text style={styles.territoryStatus}>
                        {disabled ? '사용 중' : '선택'}
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
  gachaBtnIcon: { fontSize: 16 },
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
  cardIcon: { fontSize: 32, marginBottom: 6 },
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
    minWidth: 36,
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
