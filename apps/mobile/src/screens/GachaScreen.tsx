import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { drawGacha } from '../api/gacha';
import useCharacterStore from '../store/characterStore';
import useAuthStore from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { radius, GRADE_LABEL } from '../constants/theme';

type GachaResult = {
  characterId: number;
  name: string;
  grade: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'attack' | 'defense' | 'buff';
  isNew: boolean;
  isGuaranteed: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  attack: 'ATK', defense: 'DEF', buff: 'BUF',
};

export function GachaScreen() {
  const { colors, gradeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fetchCharacters } = useCharacterStore();
  const user = useAuthStore((s) => s.user);
  const [isDrawing, setIsDrawing] = useState(false);
  const [results, setResults] = useState<GachaResult[] | null>(null);
  const [remainingPoints, setRemainingPoints] = useState<number | null>(null);

  useEffect(() => {
    if (user?.points != null) setRemainingPoints(user.points);
  }, [user?.points]);

  const handleDraw = async (count: 1 | 10) => {
    setIsDrawing(true);
    setResults(null);
    try {
      const data = await drawGacha(count);
      setResults(data.results ?? []);
      if (data.remainingPoints != null) setRemainingPoints(data.remainingPoints);
      await fetchCharacters();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
      Alert.alert('뽑기 실패', msg);
    } finally {
      setIsDrawing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* 헤더 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '300' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>캐릭터 뽑기</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 포인트 */}
      {remainingPoints != null && (
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          marginHorizontal: 16, backgroundColor: colors.goldDim,
          borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16,
        }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>보유 포인트</Text>
          <Text style={{ color: colors.gold, fontSize: 16, fontWeight: '800' }}>{remainingPoints.toLocaleString()} P</Text>
        </View>
      )}

      {/* 결과 영역 */}
      <View style={{ flex: 1, marginHorizontal: 16 }}>
        {isDrawing ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={{ color: colors.gold, fontSize: 14, marginTop: 16, fontWeight: '600' }}>뽑는 중...</Text>
          </View>
        ) : results ? (
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 8 }}>
            {results.map((r, i) => {
              const gc = gradeColor[r.grade] ?? colors.gradeCommon;
              return (
                <View key={`${r.characterId}-${i}`} style={{
                  width: '48%', backgroundColor: colors.card, borderRadius: radius.md,
                  padding: 14, alignItems: 'center', marginBottom: 12, overflow: 'hidden',
                }}>
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: gc }} />
                  {r.isNew && (
                    <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.danger, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>NEW</Text>
                    </View>
                  )}
                  {r.isGuaranteed && (
                    <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: colors.gold, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: colors.bg, fontSize: 9, fontWeight: '800' }}>천장</Text>
                    </View>
                  )}
                  <View style={{ width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 8, backgroundColor: `${gc}25` }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: gc }}>{TYPE_LABEL[r.type] ?? '?'}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>{r.name}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: gc }}>{GRADE_LABEL[r.grade]}</Text>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 32, color: colors.textMuted }}>◎</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              뽑기 버튼을 눌러{'\n'}캐릭터를 획득하세요
            </Text>
          </View>
        )}
      </View>

      {/* 버튼 */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary }}
          onPress={() => handleDraw(1)} disabled={isDrawing} activeOpacity={0.8}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>1회 뽑기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.primary }}
          onPress={() => handleDraw(10)} disabled={isDrawing} activeOpacity={0.8}
        >
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.bg }}>10회 뽑기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
