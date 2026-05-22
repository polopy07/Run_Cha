import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { drawGacha } from '../api/gacha';
import useCharacterStore from '../store/characterStore';
import useAuthStore from '../store/authStore';

type GachaResult = {
  characterId: number;
  name: string;
  grade: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'attack' | 'defense' | 'territory' | 'buff';
  isNew: boolean;
  isGuaranteed: boolean;
};

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

export function GachaScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { fetchCharacters } = useCharacterStore();
  const user = useAuthStore(s => s.user);
  const [isDrawing, setIsDrawing] = useState(false);
  const [results, setResults] = useState<GachaResult[] | null>(null);
  const [remainingPoints, setRemainingPoints] = useState<number | null>(null);

  useEffect(() => {
    if (user?.points != null) {
      setRemainingPoints(user.points);
    }
  }, [user?.points]);

  const handleDraw = async (count: 1 | 10) => {
    setIsDrawing(true);
    setResults(null);
    try {
      const data = await drawGacha(count);
      setResults(data.results ?? []);
      if (data.remainingPoints != null) {
        setRemainingPoints(data.remainingPoints);
      }
      await fetchCharacters();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
      Alert.alert('뽑기 실패', msg);
    } finally {
      setIsDrawing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'< 뒤로'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>캐릭터 뽑기</Text>
        <View style={{ width: 50 }} />
      </View>

      {remainingPoints != null && (
        <View style={styles.pointsBar}>
          <Text style={styles.pointsLabel}>보유 포인트</Text>
          <Text style={styles.pointsValue}>{remainingPoints.toLocaleString()} P</Text>
        </View>
      )}

      <View style={styles.drawArea}>
        {isDrawing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#F39C12" />
            <Text style={styles.drawingText}>뽑는 중...</Text>
          </View>
        ) : results ? (
          <ScrollView contentContainerStyle={styles.resultGrid}>
            {results.map((r, i) => (
              <View key={`${r.characterId}-${i}`} style={[styles.resultCard, { borderColor: GRADE_COLOR[r.grade] }]}>
                {r.isNew && <Text style={styles.newBadge}>NEW</Text>}
                {r.isGuaranteed && <Text style={styles.guaranteeBadge}>천장</Text>}
                <Text style={styles.resultIcon}>{TYPE_ICON[r.type] || '👤'}</Text>
                <Text style={styles.resultName} numberOfLines={1}>{r.name}</Text>
                <View style={[styles.resultGrade, { backgroundColor: GRADE_COLOR[r.grade] }]}>
                  <Text style={styles.resultGradeText}>{GRADE_LABEL[r.grade]}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.center}>
            <Text style={styles.placeholderIcon}>🎰</Text>
            <Text style={styles.placeholderText}>뽑기 버튼을 눌러 캐릭터를 획득하세요</Text>
          </View>
        )}
      </View>

      <View style={[styles.buttons, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.drawBtn, styles.drawBtn1]}
          onPress={() => handleDraw(1)}
          disabled={isDrawing}
        >
          <Text style={styles.drawBtnLabel}>1회 뽑기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.drawBtn, styles.drawBtn10]}
          onPress={() => handleDraw(10)}
          disabled={isDrawing}
        >
          <Text style={styles.drawBtnLabel}>10회 뽑기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backBtn: { color: '#2ECC71', fontSize: 14, fontWeight: '600' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  pointsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  pointsLabel: { color: '#aaa', fontSize: 13 },
  pointsValue: { color: '#F39C12', fontSize: 15, fontWeight: 'bold' },

  drawArea: { flex: 1, marginHorizontal: 16 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  drawingText: { color: '#F39C12', fontSize: 14, marginTop: 12 },
  placeholderIcon: { fontSize: 48, marginBottom: 12 },
  placeholderText: { color: '#888', fontSize: 14 },

  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  resultCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#E74C3C',
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  guaranteeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#F39C12',
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  resultIcon: { fontSize: 28, marginBottom: 6 },
  resultName: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 6 },
  resultGrade: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  resultGradeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  buttons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  drawBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  drawBtn1: { backgroundColor: '#2ECC71' },
  drawBtn10: { backgroundColor: '#F39C12' },
  drawBtnLabel: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
