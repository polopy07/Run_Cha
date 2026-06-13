import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  Alert, ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polygon, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { CharacterMarker } from '../components/CharacterMarker';
import useRunningStore from '../store/runningStore';
import { finishRunning as finishRunningAPI } from '../api/running';
import { useTheme } from '../contexts/ThemeContext';
import { radius, mapCardShadow } from '../constants/theme';
import { darkMapStyle } from '../constants/mapStyle';
import { useGPS, getLastLocation } from '../hooks/useGPS';
import { getTerritories, type Territory } from '../api/territory';
import useAuthStore from '../store/authStore';
import { getUserColor } from '../utils/colorUtils';
import { estimateRunningPoints } from '../utils/runningPointUtils';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

type Phase = 'ready' | 'running' | 'result';

type RunResult = {
  earnedPoints: number;
  distanceKm: number;
  durationSec: number;
  territory: boolean;
  representativeCharacterExp: {
    gainedExp: number;
    level: number;
    levelUps: number;
  } | null;
};

const DEFAULT_REGION = {
  latitude: 37.5665, longitude: 126.978,
  latitudeDelta: 0.01, longitudeDelta: 0.01,
};

export function RunningScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef(DEFAULT_REGION);
  const gps = useGPS();
  const initialMoveDone = useRef(false);

  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const {
    isRunning, distance, path,
    startRunning, updatePosition, finishRunning, resetRunning,
  } = useRunningStore();

  const fetchMe = useAuthStore(s => s.fetchMe);
  const user = useAuthStore(s => s.user);
  const rep = user?.representativeCharacter ?? null;
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(getLastLocation());
  const [territories, setTerritories] = useState<Territory[]>([]);

  const fetchNearbyTerritories = useCallback(async (region: Region) => {
    try {
      const data = await getTerritories({
        minLat: region.latitude - region.latitudeDelta / 2,
        maxLat: region.latitude + region.latitudeDelta / 2,
        minLng: region.longitude - region.longitudeDelta / 2,
        maxLng: region.longitude + region.longitudeDelta / 2,
      });
      setTerritories(data);
    } catch {}
  }, []);

  // Initial camera position from cached location on mount
  useEffect(() => {
    const last = getLastLocation();
    if (!last) return;
    const region = { latitude: last.latitude, longitude: last.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    fetchNearbyTerritories(region);
    const id = setTimeout(() => {
      mapRef.current?.animateToRegion(region, 500);
    }, 300);
    return () => clearTimeout(id);
  }, [fetchNearbyTerritories]);

  // Sync location state and update running position from independent GPS watcher
  useEffect(() => {
    if (!gps.currentLocation) return;
    setMyLocation(gps.currentLocation);

    if (!initialMoveDone.current) {
      initialMoveDone.current = true;
      mapRef.current?.animateToRegion(
        { ...gps.currentLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500,
      );
    }

    if (isRunning) {
      updatePosition(gps.currentLocation);
    }
  }, [gps.currentLocation, isRunning, updatePosition]);

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const lastCoord = path.length > 0 ? path[path.length - 1] : null;
  useEffect(() => {
    if (phase === 'running' && lastCoord) {
      mapRef.current?.animateToRegion(
        { latitude: lastCoord.latitude, longitude: lastCoord.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 },
        300,
      );
    }
  }, [phase, lastCoord]);

  const zoomIn = () => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
      { ...r, latitudeDelta: r.latitudeDelta * 0.5, longitudeDelta: r.longitudeDelta * 0.5 }, 200,
    );
  };

  const zoomOut = () => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
      { ...r, latitudeDelta: r.latitudeDelta * 2, longitudeDelta: r.longitudeDelta * 2 }, 200,
    );
  };

  const handleStart = async () => {
    try {
      const bgResult = await gps.start();
      if (!bgResult.ok) {
        Alert.alert('백그라운드 GPS 실패', bgResult.error ?? '알 수 없는 에러');
        return;
      }

      if (!gps.currentLocation) {
        Alert.alert('위치 오류', '현재 위치를 확인할 수 없습니다.\n위치 권한을 허용해주세요.');
        return;
      }

      startRunning();
      setElapsed(0);
      setPhase('running');
      mapRef.current?.animateToRegion(
        { ...gps.currentLocation, latitudeDelta: 0.002, longitudeDelta: 0.002 },
        500,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '러닝을 시작하지 못했습니다.';
      Alert.alert('러닝 시작 실패', message);
    }
  };

  const handleFinish = () => {
    Alert.alert('러닝 종료', '러닝을 종료하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료', style: 'destructive',
        onPress: async () => {
          await gps.stop();
          const data = finishRunning();

          if (data.path.length < 2 || data.distance < 10) {
            setResult({
              earnedPoints: 0,
              distanceKm: data.distance / 1000,
              durationSec: elapsed,
              territory: false,
              representativeCharacterExp: null,
            });
            setPhase('result');
            return;
          }

          if (!data.startedAt) return;
          setSubmitting(true);

          try {
            const res = await finishRunningAPI({
              path: data.path, distance_km: data.distance / 1000, started_at: data.startedAt,
            });
            setResult({
              earnedPoints: res.earned_points ?? 0,
              distanceKm: data.distance / 1000,
              durationSec: elapsed,
              territory: !!(res.territory),
              representativeCharacterExp: res.representativeCharacterExp
                ? {
                    gainedExp: res.representativeCharacterExp.gainedExp,
                    level: res.representativeCharacterExp.level,
                    levelUps: res.representativeCharacterExp.levelUps,
                  }
                : null,
            });
            void fetchMe().catch(() => {});
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
            Alert.alert('전송 실패', msg);
            setResult({
              earnedPoints: 0,
              distanceKm: data.distance / 1000,
              durationSec: elapsed,
              territory: false,
              representativeCharacterExp: null,
            });
          } finally {
            setSubmitting(false);
            setPhase('result');
          }
        },
      },
    ]);
  };

  const handleReset = () => {
    resetRunning();
    setResult(null);
    setElapsed(0);
    setPhase('ready');
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDist = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatPace = (meters: number, sec: number) => {
    if (meters < 10 || sec <= 0) return '--:--';
    const paceSecPerKm = sec / (meters / 1000);
    const pm = Math.floor(paceSecPerKm / 60);
    const ps = Math.round(paceSecPerKm % 60);
    return `${pm}'${String(ps).padStart(2, '0')}"`;
  };

  const polylineCoords = path.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
  const noDistance = result ? result.distanceKm * 1000 < 10 : false;

  // === 결과 화면 ===
  if (phase === 'result' && result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 48, color: colors.primary, marginBottom: 8 }}>
            {noDistance ? '◇' : result.territory ? '⬡' : '▶'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
            {noDistance ? '이동 기록이 없습니다' : result.territory ? '영토 획득!' : '러닝 완료!'}
          </Text>
          {noDistance && (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
              GPS 위치 이동이 감지되지 않았습니다.
            </Text>
          )}
        </View>

        <View style={{
          backgroundColor: colors.surface, borderRadius: radius.lg,
          padding: 20, width: '100%', marginBottom: 16,
          borderWidth: 1, borderColor: colors.divider,
        }}>
          <ResultRow colors={colors} label="거리" value={formatDist(result.distanceKm * 1000)} />
          <ResultRow colors={colors} label="시간" value={formatTime(result.durationSec)} />
          <ResultRow colors={colors} label="페이스" value={formatPace(result.distanceKm * 1000, result.durationSec)} />
          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 4 }} />
          <ResultRow colors={colors} label="획득 포인트" value={`+${result.earnedPoints.toLocaleString()}P`} highlight={!noDistance} />
          {result.representativeCharacterExp && (
            <ResultRow
              colors={colors}
              label="대표 캐릭터 EXP"
              value={
                result.representativeCharacterExp.levelUps > 0
                  ? `+${result.representativeCharacterExp.gainedExp} EXP · Lv.${result.representativeCharacterExp.level}`
                  : `+${result.representativeCharacterExp.gainedExp} EXP`
              }
              highlight
            />
          )}
          {result.territory && <ResultRow colors={colors} label="영토" value="새 영토 생성됨" highlight />}
        </View>

        {polylineCoords.length > 1 && (
          <View style={{ width: '100%', height: 180, borderRadius: radius.md, overflow: 'hidden', marginBottom: 24 }}>
            <MapView
              style={{ flex: 1 }}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
              customMapStyle={Platform.OS === 'android' && isDark ? darkMapStyle : undefined}
              initialRegion={{
                latitude: polylineCoords[0].latitude, longitude: polylineCoords[0].longitude,
                latitudeDelta: 0.01, longitudeDelta: 0.01,
              }}
              scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
            >
              <Polyline coordinates={polylineCoords} strokeColor={colors.primary} strokeWidth={4} />
            </MapView>
          </View>
        )}

        <TouchableOpacity
          style={{ backgroundColor: colors.primary, borderRadius: radius.xl, paddingVertical: 14, width: '100%', alignItems: 'center' }}
          onPress={handleReset} activeOpacity={0.85}
        >
          <Text style={{ color: colors.bg, fontSize: 18, fontWeight: '800' }}>확인</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // === 준비 / 러닝 중 화면 ===
  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={(() => {
          const last = getLastLocation();
          return last
            ? { latitude: last.latitude, longitude: last.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : DEFAULT_REGION;
        })()}
        customMapStyle={Platform.OS === 'android' && isDark ? darkMapStyle : undefined}
        showsUserLocation={!(user && myLocation)}
        showsMyLocationButton={false}
        followsUserLocation={Platform.OS === 'ios'}
        onRegionChange={(r) => { regionRef.current = r; }}
        onRegionChangeComplete={(r) => { regionRef.current = r; fetchNearbyTerritories(r); }}
      >
        {territories.map((t) => {
          const isMine = t.userId === user?.id;
          const color = isMine ? colors.primary : getUserColor(t.userId);
          return (
            <Polygon
              key={t.id}
              coordinates={t.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }))}
              fillColor={color + '30'}
              strokeColor={color + '80'}
              strokeWidth={isMine ? 2 : 1}
            />
          );
        })}
        {polylineCoords.length > 1 && (
          <Polyline coordinates={polylineCoords} strokeColor={colors.primary} strokeWidth={5} />
        )}
        {myLocation && user && (
          <CharacterMarker
            key={rep ? `${rep.grade}-${rep.type}` : 'no-rep'}
            user={{
              userId: user.id,
              nickname: user.nickname,
              lat: myLocation.latitude,
              lng: myLocation.longitude,
              character: rep
                ? { name: rep.name, type: rep.type, grade: rep.grade, imageUrl: rep.imageUrl }
                : null,
            }}
            isMe
          />
        )}
      </MapView>

      {phase === 'running' && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          backgroundColor: colors.overlay,
          paddingBottom: 14, paddingHorizontal: 16, paddingTop: STATUS_BAR_HEIGHT + 12,
          ...mapCardShadow(isDark),
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>시간</Text>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{formatTime(elapsed)}</Text>
            </View>
            <View style={{ width: 1, height: 36, backgroundColor: colors.divider }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>거리</Text>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{formatDist(distance)}</Text>
            </View>
            <View style={{ width: 1, height: 36, backgroundColor: colors.divider }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>페이스</Text>
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{formatPace(distance, elapsed)}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.divider, marginTop: 12, marginBottom: 8 }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 2 }}>예상 포인트</Text>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>
              +{estimateRunningPoints(distance, elapsed).toLocaleString()} P
            </Text>
          </View>
        </View>
      )}

      {phase === 'ready' && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          alignItems: 'center', backgroundColor: colors.overlay,
          paddingBottom: 24, paddingTop: STATUS_BAR_HEIGHT + 20,
          ...mapCardShadow(isDark),
        }}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>러닝 준비</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            달린 경로가 폐곡선을 이루면{'\n'}영토가 생성됩니다!
          </Text>
        </View>
      )}

      {phase !== 'result' && (
        <View style={{ position: 'absolute', right: 12, top: '42%' }}>
          {[
            { label: '+', onPress: zoomIn },
            { label: '−', onPress: zoomOut },
          ].map((btn) => (
            <TouchableOpacity key={btn.label} onPress={btn.onPress} style={{
              width: 32, height: 32, backgroundColor: colors.overlayLight, opacity: 0.55,
              borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center', marginBottom: 4,
              ...mapCardShadow(isDark),
            }}>
              <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 8 }} />
          <TouchableOpacity
            style={{
              width: 32, height: 32, backgroundColor: colors.overlayLight, opacity: 0.55,
              borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center',
              ...mapCardShadow(isDark),
            }}
            onPress={() => {
              const loc = gps.currentLocation ?? getLastLocation();
              if (!loc) {
                Alert.alert('위치 오류', '현재 위치를 확인할 수 없습니다.');
                return;
              }
              mapRef.current?.animateToRegion(
                { latitude: loc.latitude, longitude: loc.longitude,
                  latitudeDelta: phase === 'running' ? 0.002 : 0.01,
                  longitudeDelta: phase === 'running' ? 0.002 : 0.01 }, 500,
              );
            }}
          >
            <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>◎</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: insets.bottom + 8 }}>
        {phase === 'ready' && (
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: radius.xl, paddingVertical: 16, width: '100%', alignItems: 'center' }}
            onPress={handleStart} activeOpacity={0.85}
          >
            <Text style={{ color: colors.bg, fontSize: 18, fontWeight: '800' }}>러닝 시작</Text>
          </TouchableOpacity>
        )}

        {phase === 'running' && (
          <TouchableOpacity
            style={{ backgroundColor: colors.danger, borderRadius: radius.xl, paddingVertical: 16, width: '100%', alignItems: 'center' }}
            onPress={handleFinish} disabled={submitting} activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>러닝 종료</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ResultRow({ colors, label, value, highlight = false }: {
  colors: { textSecondary: string; text: string; primary: string };
  label: string; value: string; highlight?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: highlight ? colors.primary : colors.text, fontSize: highlight ? 18 : 17, fontWeight: highlight ? '800' : '600' }}>{value}</Text>
    </View>
  );
}
