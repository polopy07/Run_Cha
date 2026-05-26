import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useRunningStore from '../store/runningStore';
import useAuthStore from '../store/authStore';
import { finishRunning as finishRunningAPI } from '../api/running';

type Phase = 'ready' | 'running' | 'result';

type RunResult = {
  earnedPoints: number;
  distanceKm: number;
  durationSec: number;
  territory: boolean;
};

const DEFAULT_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export function RunningScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const {
    isRunning,
    distance,
    path,
    startRunning,
    updatePosition,
    finishRunning,
    resetRunning,
  } = useRunningStore();

  const fetchMe = useAuthStore(s => s.fetchMe);

  // --- 타이머 ---
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // --- 러닝 중 카메라 따라가기 ---
  const lastCoord = path.length > 0 ? path[path.length - 1] : null;
  useEffect(() => {
    if (phase === 'running' && lastCoord) {
      mapRef.current?.animateToRegion(
        {
          latitude: lastCoord.latitude,
          longitude: lastCoord.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        300,
      );
    }
  }, [phase, lastCoord]);

  // --- GPS 콜백 ---
  const handleUserLocationChange = useCallback(
    (e: { nativeEvent: { coordinate?: { latitude: number; longitude: number } } }) => {
      const coordinate = e.nativeEvent.coordinate;
      if (!coordinate) return;
      userLocationRef.current = coordinate;

      if (isRunning) {
        updatePosition({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      }
    },
    [isRunning, updatePosition],
  );

  // --- 러닝 시작 ---
  const handleStart = () => {
    if (!userLocationRef.current) {
      Alert.alert('위치 오류', '현재 위치를 확인할 수 없습니다.\n위치 권한을 허용해주세요.');
      return;
    }
    startRunning();
    setElapsed(0);
    setPhase('running');
  };

  // --- 러닝 종료 ---
  const handleFinish = () => {
    Alert.alert('러닝 종료', '러닝을 종료하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료',
        style: 'destructive',
        onPress: async () => {
          const data = finishRunning();
          setSubmitting(true);

          try {
            const res = await finishRunningAPI({
              path: data.path,
              distance_km: data.distance / 1000,
              started_at: data.startedAt!,
            });

            setResult({
              earnedPoints: res.earned_points ?? 0,
              distanceKm: data.distance / 1000,
              durationSec: elapsed,
              territory: !!(res.territory),
            });

            // 포인트 갱신
            fetchMe();
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
            Alert.alert('전송 실패', msg);
            setResult({
              earnedPoints: 0,
              distanceKm: data.distance / 1000,
              durationSec: elapsed,
              territory: false,
            });
          } finally {
            setSubmitting(false);
            setPhase('result');
          }
        },
      },
    ]);
  };

  // --- 결과 화면에서 돌아가기 ---
  const handleReset = () => {
    resetRunning();
    setResult(null);
    setElapsed(0);
    setPhase('ready');
  };

  // --- 포맷 헬퍼 ---
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatPace = (meters: number, sec: number) => {
    if (meters <= 0 || sec <= 0) return '--:--';
    const paceSecPerKm = sec / (meters / 1000);
    const pm = Math.floor(paceSecPerKm / 60);
    const ps = Math.round(paceSecPerKm % 60);
    return `${pm}'${String(ps).padStart(2, '0')}"`;
  };

  // --- 지도 polyline 좌표 ---
  const polylineCoords = path.map(p => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  // ============================
  //  결과 화면
  // ============================
  if (phase === 'result' && result) {
    return (
      <View style={styles.resultContainer}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultEmoji}>{result.territory ? '🏴' : '🏃'}</Text>
          <Text style={styles.resultTitle}>
            {result.territory ? '영토 획득!' : '러닝 완료!'}
          </Text>
        </View>

        <View style={styles.resultCard}>
          <ResultRow label="거리" value={formatDistance(result.distanceKm * 1000)} />
          <ResultRow label="시간" value={formatTime(result.durationSec)} />
          <ResultRow label="페이스" value={formatPace(result.distanceKm * 1000, result.durationSec)} />
          <View style={styles.resultDivider} />
          <ResultRow
            label="획득 포인트"
            value={`+${result.earnedPoints.toLocaleString()}P`}
            highlight
          />
          {result.territory && (
            <ResultRow label="영토" value="새 영토 생성됨" highlight />
          )}
        </View>

        {/* 경로 미니맵 */}
        {polylineCoords.length > 1 && (
          <View style={styles.resultMapContainer}>
            <MapView
              style={styles.resultMap}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: polylineCoords[0].latitude,
                longitude: polylineCoords[0].longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              <Polyline
                coordinates={polylineCoords}
                strokeColor="#2ECC71"
                strokeWidth={4}
              />
            </MapView>
          </View>
        )}

        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>확인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============================
  //  준비 / 러닝 중 화면
  // ============================
  return (
    <View style={styles.container}>
      {/* 지도 */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        onUserLocationChange={handleUserLocationChange}
      >
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#2ECC71"
            strokeWidth={5}
          />
        )}
      </MapView>

      {/* 러닝 중 상단 통계 패널 */}
      {phase === 'running' && (
        <View style={[styles.statsPanel, { paddingTop: insets.top + 12 }]}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>시간</Text>
            <Text style={styles.statValue}>{formatTime(elapsed)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>거리</Text>
            <Text style={styles.statValue}>{formatDistance(distance)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>페이스</Text>
            <Text style={styles.statValue}>{formatPace(distance, elapsed)}</Text>
          </View>
        </View>
      )}

      {/* 준비 화면 안내 */}
      {phase === 'ready' && (
        <View style={[styles.readyOverlay, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.readyTitle}>러닝 준비</Text>
          <Text style={styles.readyDesc}>
            달린 경로가 폐곡선을 이루면{'\n'}영토가 생성됩니다!
          </Text>
        </View>
      )}

      {/* 하단 버튼 */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {phase === 'ready' && (
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Text style={styles.startBtnText}>🏃 러닝 시작</Text>
          </TouchableOpacity>
        )}

        {phase === 'running' && (
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={handleFinish}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.stopBtnText}>⏹ 러닝 종료</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// --- 결과 행 컴포넌트 ---
function ResultRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultValue, highlight && styles.resultHighlight]}>
        {value}
      </Text>
    </View>
  );
}

// ===========================================
//  스타일
// ===========================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // --- 러닝 중 상단 통계 ---
  statsPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 31, 0.92)',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statLabel: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },

  // --- 준비 화면 ---
  readyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 31, 0.85)',
    paddingBottom: 24,
  },
  readyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  readyDesc: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // --- 하단 버튼 ---
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  startBtn: {
    backgroundColor: '#2ECC71',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 48,
    elevation: 6,
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  stopBtn: {
    backgroundColor: '#E74C3C',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 48,
    elevation: 6,
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // --- 결과 화면 ---
  resultContainer: {
    flex: 1,
    backgroundColor: '#12121F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultHeader: { alignItems: 'center', marginBottom: 24 },
  resultEmoji: { fontSize: 48, marginBottom: 8 },
  resultTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },

  resultCard: {
    backgroundColor: '#1E1E2E',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultLabel: { color: '#aaa', fontSize: 15 },
  resultValue: { color: '#fff', fontSize: 17, fontWeight: '600' },
  resultHighlight: { color: '#2ECC71', fontWeight: 'bold', fontSize: 18 },
  resultDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },

  resultMapContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  resultMap: { flex: 1 },

  resetBtn: {
    backgroundColor: '#2ECC71',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  resetBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
