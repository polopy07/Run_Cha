import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  Alert, ScrollView, Animated, Easing,
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

function GachaOrb({ colors }: { colors: { gold: string; primary: string; bg: string; textMuted: string } }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.95, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const rotateAnim = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
    );
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.8, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseAnim.start();
    rotateAnim.start();
    glowAnim.start();
    return () => { pulseAnim.stop(); rotateAnim.stop(); glowAnim.stop(); };
  }, [pulse, rotate, glow]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 120, height: 120, borderRadius: 60,
        backgroundColor: colors.gold, opacity: glow,
      }} />
      <Animated.View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.gold,
        justifyContent: 'center', alignItems: 'center',
        transform: [{ scale: pulse }, { rotate: spin }],
      }}>
        <Text style={{ fontSize: 28, color: colors.gold, fontWeight: '800' }}>◎</Text>
      </Animated.View>
      <Text style={{ color: colors.gold, fontSize: 14, fontWeight: '700', marginTop: 20 }}>뽑는 중...</Text>
    </View>
  );
}

function AnimatedCard({ result, index, colors, gradeColor }: {
  result: GachaResult; index: number;
  colors: { card: string; danger: string; gold: string; bg: string; text: string; gradeCommon: string };
  gradeColor: Record<string, string>;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 120;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1, duration: 350, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 250, delay, useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, index]);

  const gc = gradeColor[result.grade] ?? colors.gradeCommon;

  return (
    <Animated.View style={{
      width: '48%', backgroundColor: colors.card, borderRadius: radius.md,
      padding: 14, alignItems: 'center', marginBottom: 12, overflow: 'hidden',
      opacity, transform: [{ scale }],
    }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: gc }} />
      {result.isNew && (
        <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: colors.danger, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>NEW</Text>
        </View>
      )}
      {result.isGuaranteed && (
        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: colors.gold, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: colors.bg, fontSize: 9, fontWeight: '800' }}>천장</Text>
        </View>
      )}
      <View style={{ width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 8, backgroundColor: `${gc}25` }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: gc }}>{TYPE_LABEL[result.type] ?? '?'}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>{result.name}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: gc }}>{GRADE_LABEL[result.grade]}</Text>
    </Animated.View>
  );
}

export function GachaScreen() {
  const { colors, gradeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fetchCharacters } = useCharacterStore();
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [isDrawing, setIsDrawing] = useState(false);
  const [results, setResults] = useState<GachaResult[] | null>(null);
  const [remainingPoints, setRemainingPoints] = useState<number | null>(null);
  const [revealKey, setRevealKey] = useState(0);

  useEffect(() => {
    if (user?.points != null) setRemainingPoints(user.points);
  }, [user?.points]);

  const handleDraw = useCallback(async (count: 1 | 10) => {
    const cost = count === 1 ? 100 : 900;
    if ((remainingPoints ?? 0) < cost) {
      Alert.alert('포인트 부족', `${cost}P가 필요합니다.`);
      return;
    }
    setIsDrawing(true);
    setResults(null);
    try {
      const data = await drawGacha(count);
      setRevealKey(k => k + 1);
      setResults(data.results ?? []);
      if (data.remainingPoints != null) setRemainingPoints(data.remainingPoints);
      void fetchMe().catch(() => {});
      void fetchCharacters().catch(() => {});
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
      Alert.alert('뽑기 실패', msg);
    } finally {
      setIsDrawing(false);
    }
  }, [remainingPoints, fetchMe, fetchCharacters]);

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
            <GachaOrb colors={colors} />
          </View>
        ) : results ? (
          <ScrollView key={revealKey} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: 8 }}>
            {results.map((r, i) => (
              <AnimatedCard key={`${r.characterId}-${i}`} result={r} index={i} colors={colors} gradeColor={gradeColor} />
            ))}
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
