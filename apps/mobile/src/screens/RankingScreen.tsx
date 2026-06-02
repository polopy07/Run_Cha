import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAreaRanking, getDistanceRanking } from '../api/ranking';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../constants/theme';
import { useSocket } from '../hooks/useSocket';

type Tab = 'area' | 'distance';
type AreaEntry = { rank: number; userId: number; nickname: string; totalAreaSqm: number };
type DistanceEntry = { rank: number; userId: number; nickname: string; totalDistanceKm: number };
type RankEntry = AreaEntry | DistanceEntry;

const MEDAL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const MEDAL_COLOR: Record<number, string> = { 1: '#FFB300', 2: '#B0B0C0', 3: '#CD7F32' };

function fmtArea(sqm: number) { return sqm >= 1e6 ? `${(sqm / 1e6).toFixed(2)} km²` : `${sqm.toLocaleString()} m²`; }
function fmtDist(km: number) { return `${km.toFixed(2)} km`; }

export function RankingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('area');
  const [data, setData] = useState<RankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetch = useCallback(async (loader = true) => {
    if (loader) setIsLoading(true);
    try {
      const res = tab === 'area' ? await getAreaRanking() : await getDistanceRanking();
      setData(res as RankEntry[]);
    } catch { setData([]); } finally { setIsLoading(false); setIsRefreshing(false); }
  }, [tab]);

  useSocket({
    onRankingUpdate: () => { void fetch(false); },
  });

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = () => { setIsRefreshing(true); fetch(false); };

  const renderItem = ({ item }: { item: RankEntry }) => {
    const isTop = item.rank <= 3;
    const value = 'totalAreaSqm' in item ? fmtArea(item.totalAreaSqm) : fmtDist((item as DistanceEntry).totalDistanceKm);

    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 12,
        borderBottomWidth: isTop ? 0 : 1, borderBottomColor: colors.divider,
        backgroundColor: isTop ? colors.card : 'transparent',
        borderRadius: isTop ? radius.sm : 0,
        marginBottom: isTop ? 4 : 0,
      }}>
        <View style={{ width: 44, alignItems: 'center' }}>
          {isTop ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: `${MEDAL_COLOR[item.rank]}20` }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: MEDAL_COLOR[item.rank] }}>{MEDAL[item.rank]}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMuted }}>{item.rank}</Text>
          )}
        </View>
        <Text style={{ flex: 1, fontSize: 15, marginLeft: 8, color: isTop ? colors.text : colors.textSecondary, fontWeight: isTop ? '700' : '400' }} numberOfLines={1}>{item.nickname}</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 }}>랭킹</Text>

      <View style={{
        flexDirection: 'row', backgroundColor: colors.surface,
        borderRadius: radius.md, padding: 3, marginBottom: 16,
      }}>
        {(['area', 'distance'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={{
              flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm,
              backgroundColor: tab === t ? colors.primary : 'transparent',
            }}
            onPress={() => setTab(t)}
          >
            <Text style={{
              fontSize: 14, fontWeight: '600',
              color: tab === t ? colors.bg : colors.textMuted,
            }}>
              {t === 'area' ? '면적' : '거리'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : data.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>랭킹 데이터가 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={data} keyExtractor={(item) => `${item.userId}`} renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}
