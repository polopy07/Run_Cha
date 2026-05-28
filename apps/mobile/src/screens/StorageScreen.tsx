import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable,
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CharacterStackParamList } from '../navigation/CharacterStack';
import { deployCharacter } from '../api/character';
import { getMyTerritories, type Territory } from '../api/territory';
import useCharacterStore, { type Character } from '../store/characterStore';
import { useTheme } from '../contexts/ThemeContext';
import { radius, GRADE_LABEL } from '../constants/theme';

type Nav = StackNavigationProp<CharacterStackParamList, 'Storage'>;

const TYPE_LABEL: Record<string, string> = { attack: 'ATK', defense: 'DEF', buff: 'BUF' };
const TYPE_FULL: Record<string, string> = { attack: '공격', defense: '방어', buff: '버프' };

function formatArea(sqm: number) { return `${Math.round(sqm).toLocaleString()} ㎡`; }
function getErr(e: unknown, fb: string) { return e instanceof Error ? e.message : fb; }

export function StorageScreen() {
  const { colors, gradeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { characters, isLoading, fetchCharacters, updateCharacter } = useCharacterStore();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selected, setSelected] = useState<Character | null>(null);

  const deployedIds = useMemo(
    () => new Set(characters.map((c) => c.deployedTerritoryId).filter((id): id is number => typeof id === 'number')),
    [characters],
  );

  const load = useCallback(async () => {
    const [cr, tr] = await Promise.allSettled([fetchCharacters(), getMyTerritories()]);
    if (cr.status === 'rejected') { setTerritories([]); throw cr.reason; }
    if (tr.status === 'rejected') { setTerritories([]); throw tr.reason; }
    setTerritories(tr.value);
  }, [fetchCharacters]);

  useEffect(() => { load().catch((e) => Alert.alert('로드 실패', getErr(e, '데이터를 불러올 수 없습니다.'))); }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await load(); } catch (e) { Alert.alert('로드 실패', getErr(e, '데이터를 불러올 수 없습니다.')); } finally { setIsRefreshing(false); }
  }, [load]);

  const openDeploy = (c: Character) => {
    if (c.type === 'attack') { Alert.alert('배치 불가', '방어/버프 캐릭터만 영토에 배치할 수 있습니다.'); return; }
    setSelected(c);
  };

  const submitDeploy = async (tid: number | null) => {
    if (!selected) return;
    setIsDeploying(true);
    try {
      const updated = await deployCharacter(selected.id, tid);
      updateCharacter(updated);
      setSelected(null);
    } catch (e) { Alert.alert('배치 실패', getErr(e, '다시 시도해주세요.')); } finally { setIsDeploying(false); }
  };

  const renderItem = ({ item }: { item: Character }) => {
    const gc = gradeColor[item.grade] ?? colors.gradeCommon;
    return (
      <TouchableOpacity style={{
        width: '48%', backgroundColor: colors.card, borderRadius: radius.md,
        padding: 14, alignItems: 'center', overflow: 'hidden',
      }} activeOpacity={0.85} onPress={() => openDeploy(item)}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: gc }} />
        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: `${gc}30` }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: gc }}>{GRADE_LABEL[item.grade]}</Text>
          </View>
          <Text style={{ fontSize: 9, color: colors.textMuted }}>
            {item.isDeployed ? `배치 #${item.deployedTerritoryId}` : item.type !== 'attack' ? '미배치' : '—'}
          </Text>
        </View>

        <View style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8, backgroundColor: `${gc}20` }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: gc }}>{TYPE_LABEL[item.type] ?? '?'}</Text>
        </View>

        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 }} numberOfLines={1}>{item.name}</Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 8 }}>{TYPE_FULL[item.type] ?? item.type}</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
          {['ATK', 'DEF', 'SPD', 'PT'].map((label, i) => (
            <View key={label} style={{ backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>
                {label} {[item.attackLv, item.defenseLv, item.speedLv, item.pointLv][i]}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>캐릭터 보관함</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{characters.length}개 보유</Text>
        </View>
        <TouchableOpacity style={{ backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: 20, paddingVertical: 10 }} onPress={() => navigation.navigate('Gacha')}>
          <Text style={{ color: colors.bg, fontSize: 13, fontWeight: '800' }}>뽑기</Text>
        </TouchableOpacity>
      </View>

      {isLoading && characters.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : characters.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '600' }}>보유 캐릭터 없음</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>뽑기에서 캐릭터를 획득해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={characters} keyExtractor={(item) => `${item.id}`} renderItem={renderItem}
          numColumns={2} columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      {/* 배치 모달 */}
      <Modal transparent visible={selected !== null} animationType="slide" onRequestClose={() => !isDeploying && setSelected(null)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => !isDeploying && setSelected(null)}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, gap: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider, alignSelf: 'center', marginBottom: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{selected?.name}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>배치할 영토를 선택하세요</Text>

            {selected?.isDeployed && (
              <TouchableOpacity style={{ backgroundColor: colors.dangerDim, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: 4 }} disabled={isDeploying} onPress={() => submitDeploy(null)}>
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 14 }}>배치 해제</Text>
              </TouchableOpacity>
            )}

            {territories.length === 0 ? (
              <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: 24 }}>보유 영토가 없습니다</Text>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {territories.map((t) => {
                  const disabled = deployedIds.has(t.id) && t.id !== selected?.deployedTerritoryId;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: colors.card, borderRadius: radius.sm,
                        paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
                        opacity: disabled ? 0.35 : 1,
                      }}
                      disabled={disabled || isDeploying} onPress={() => submitDeploy(t.id)}
                    >
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>영토 #{t.id}</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{formatArea(t.areaSqm)} · 점유 {t.occupationRate}%</Text>
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
