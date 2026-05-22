import React, { useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CharacterStackParamList } from '../navigation/CharacterStack';
import useCharacterStore, { Character } from '../store/characterStore';

type Nav = StackNavigationProp<CharacterStackParamList, 'Storage'>;

const GRADE_COLOR: Record<string, string> = {
  common: '#95A5A6',
  rare: '#3498DB',
  epic: '#9B59B6',
  legendary: '#F39C12',
};

const GRADE_LABEL: Record<string, string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
};

const TYPE_ICON: Record<string, string> = {
  attack: '⚔️',
  defense: '🛡️',
  territory: '🏴',
  buff: '✨',
};

export function StorageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { characters, isLoading, fetchCharacters } = useCharacterStore();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchCharacters();
    setIsRefreshing(false);
  }, [fetchCharacters]);

  const renderItem = ({ item }: { item: Character }) => {
    const gradeColor = GRADE_COLOR[item.grade] || '#95A5A6';
    return (
      <View style={[styles.card, { borderColor: gradeColor }]}>
        <View style={[styles.gradeBadge, { backgroundColor: gradeColor }]}>
          <Text style={styles.gradeText}>{GRADE_LABEL[item.grade] || item.grade}</Text>
        </View>
        <Text style={styles.cardIcon}>{TYPE_ICON[item.type] || '👤'}</Text>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>⚔{item.attackLv}</Text>
          <Text style={styles.stat}>🛡{item.defenseLv}</Text>
          <Text style={styles.stat}>💨{item.speedLv}</Text>
          <Text style={styles.stat}>P{item.pointLv}</Text>
        </View>
        {item.isDeployed && (
          <View style={styles.deployedBadge}>
            <Text style={styles.deployedText}>배치중</Text>
          </View>
        )}
      </View>
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
          keyExtractor={item => `${item.id}`}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2ECC71" />
          }
        />
      )}
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
  gradeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 8,
  },
  gradeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardIcon: { fontSize: 32, marginBottom: 6 },
  cardName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 6 },
  stat: { fontSize: 11, color: '#666' },
  deployedBadge: {
    marginTop: 8,
    backgroundColor: '#2ECC71',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deployedText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#888', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#aaa' },
});
