import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAreaRanking, getDistanceRanking } from '../api/ranking';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../constants/theme';
import { useSocket } from '../hooks/useSocket';
import useAuthStore from '../store/authStore';

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
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<Tab>('area');
  const [areaData, setAreaData] = useState<RankEntry[]>([]);
  const [distData, setDistData] = useState<RankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAll = useCallback(async (loader = true) => {
    if (loader) setIsLoading(true);
    try {
      const [areaRes, distRes] = await Promise.all([getAreaRanking(), getDistanceRanking()]);
      setAreaData((areaRes as { rankings: RankEntry[] }).rankings ?? []);
      setDistData((distRes as { rankings: RankEntry[] }).rankings ?? []);
    } catch {
      setAreaData([]);
      setDistData([]);
    } finally { setIsLoading(false); setIsRefreshing(false); }
  }, []);

  useSocket({
    onRankingUpdate: () => { void fetchAll(false); },
  });

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));
  const onRefresh = () => { setIsRefreshing(true); fetchAll(false); };

  const data = tab === 'area' ? areaData : distData;

  const renderItem = ({ item }: { item: RankEntry }) => {
    const isTop = item.rank <= 3;
    const isMe = item.userId === user?.id;
    const value = 'totalAreaSqm' in item ? fmtArea(item.totalAreaSqm) : fmtDist((item as DistanceEntry).totalDistanceKm);

    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: 12,
        borderBottomWidth: isTop ? 0 : 1, borderBottomColor: colors.divider,
        backgroundColor: isMe ? colors.primary + '15' : isTop ? colors.card : 'transparent',
        borderRadius: isTop || isMe ? radius.sm : 0,
        marginBottom: isTop ? 4 : 0,
        borderLeftWidth: isMe ? 3 : 0,
        borderLeftColor: isMe ? colors.primary : 'transparent',
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
