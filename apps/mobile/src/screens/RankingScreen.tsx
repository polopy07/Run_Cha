import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAreaRanking, getDistanceRanking } from '../api/ranking';

type Tab = 'area' | 'distance';

type AreaEntry = {
  rank: number;
  userId: number;
  nickname: string;
  totalAreaSqm: number;
};

type DistanceEntry = {
  rank: number;
  userId: number;
  nickname: string;
  totalDistanceKm: number;
};

type RankEntry = AreaEntry | DistanceEntry;

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) {
    return `${(sqm / 1_000_000).toFixed(2)} km²`;
  }
  return `${sqm.toLocaleString()} m²`;
}

function formatDistance(km: number): string {
  return `${km.toFixed(2)} km`;
}

export function RankingScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('area');
  const [data, setData] = useState<RankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchRanking = useCallback(async (showLoader = true) => {
    if (showLoader) { setIsLoading(true); }
    try {
      const result = tab === 'area'
        ? await getAreaRanking()
        : await getDistanceRanking();
      setData(result as RankEntry[]);
    } catch {
      setData([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchRanking(false);
  };

  const renderItem = ({ item }: { item: RankEntry }) => {
    const isTop3 = item.rank <= 3;
    const medal = RANK_MEDAL[item.rank];
    const value = 'totalAreaSqm' in item
      ? formatArea(item.totalAreaSqm)
      : formatDistance((item as DistanceEntry).totalDistanceKm);

    return (
      <View style={[styles.row, isTop3 && styles.rowTop3]}>
        <View style={styles.rankCol}>
          {medal ? (
            <Text style={styles.medal}>{medal}</Text>
          ) : (
            <Text style={styles.rankNum}>{item.rank}</Text>
          )}
        </View>
        <Text style={[styles.nickname, isTop3 && styles.nicknameTop3]} numberOfLines={1}>
          {item.nickname}
        </Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>랭킹</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'area' && styles.tabActive]}
          onPress={() => setTab('area')}
        >
          <Text style={[styles.tabText, tab === 'area' && styles.tabTextActive]}>
            면적
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'distance' && styles.tabActive]}
          onPress={() => setTab('distance')}
        >
          <Text style={[styles.tabText, tab === 'distance' && styles.tabTextActive]}>
            거리
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2ECC71" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>랭킹 데이터가 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => `${item.userId}`}
          renderItem={renderItem}
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
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#2ECC71' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#fff' },

  list: { paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  rowTop3: { backgroundColor: '#FAFFF5' },
  rankCol: { width: 36, alignItems: 'center' },
  medal: { fontSize: 20 },
  rankNum: { fontSize: 15, fontWeight: '600', color: '#888' },
  nickname: { flex: 1, fontSize: 15, color: '#333', marginLeft: 8 },
  nicknameTop3: { fontWeight: 'bold', color: '#1a1a1a' },
  value: { fontSize: 14, fontWeight: '600', color: '#2ECC71' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#888' },
});
