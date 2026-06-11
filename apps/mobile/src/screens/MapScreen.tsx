import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View, Text, Image, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { getCharacterImageSource, getCharacterImageTransform } from '../assets/characters/characterImages';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { radius, mapCardShadow, GRADE_LABEL } from '../constants/theme';
import { darkMapStyle } from '../constants/mapStyle';
import useAuthStore from '../store/authStore';
import { getTerritories, type Territory } from '../api/territory';
import { TerritoryDetailSheet } from '../components/TerritoryDetailSheet';
import { AttackTerritoryPanel } from '../components/attack/AttackTerritoryPanel';
import { getUserColor } from '../utils/colorUtils';
import { formatAreaCompact } from '../utils/formatUtils';
import { useSocket } from '../hooks/useSocket';
import { CharacterMarker } from '../components/CharacterMarker';
import { useGPS, getLastLocation } from '../hooks/useGPS';

function getCentroid(coords: { lat: number; lng: number }[]): { latitude: number; longitude: number } {
  const len = coords.length || 1;
  const sum = coords.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
  return { latitude: sum.lat / len, longitude: sum.lng / len };
}

type BottomTabParamList = {
  '홈': undefined; '캐릭터': undefined; '러닝': undefined; '랭킹': undefined; '메뉴': undefined;
};
type MapNav = BottomTabNavigationProp<BottomTabParamList, '홈'>;

const INITIAL_REGION = {
  latitude: 37.5665, longitude: 126.978,
  latitudeDelta: 0.02, longitudeDelta: 0.02,
};

export function MapScreen() {
  const { colors, isDark, gradeColor } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MapNav>();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef(INITIAL_REGION);
  const initialMoveDone = useRef(false);
  const lastEmitRef = useRef(0);
  const user = useAuthStore(s => s.user);
  const rep = user?.representativeCharacter ?? null;
  const gps = useGPS();
  const { nearbyUsers, emitLocation } = useSocket({
    onTerritoryUpdate: () => fetchTerritories(regionRef.current),
  });
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [attackTerritoryId, setAttackTerritoryId] = useState<number | null>(null);
  const [attackTerritoryName, setAttackTerritoryName] = useState<string | undefined>();
  const [attackVisible, setAttackVisible] = useState(false);

  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchTerritories = useCallback(async (region: Region) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const bounds = {
      minLat: region.latitude - region.latitudeDelta / 2,
      maxLat: region.latitude + region.latitudeDelta / 2,
      minLng: region.longitude - region.longitudeDelta / 2,
      maxLng: region.longitude + region.longitudeDelta / 2,
    };
    try {
      const data = await getTerritories(bounds, { signal: controller.signal });
      if (!controller.signal.aborted && isMountedRef.current) setTerritories(data);
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.warn('fetchTerritories error:', e.message);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTerritories(regionRef.current);
    }, [fetchTerritories]),
  );

  // Initial camera move to GPS location (once)
  useEffect(() => {
    if (!gps.currentLocation || initialMoveDone.current) return;
    initialMoveDone.current = true;
    const region = {
      latitude: gps.currentLocation.latitude,
      longitude: gps.currentLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    mapRef.current?.animateToRegion(region, 500);
    fetchTerritories(region);
  }, [gps.currentLocation, fetchTerritories]);

  // Emit socket location with 3-second throttle
  useEffect(() => {
    if (!gps.currentLocation) return;
    const now = Date.now();
    if (now - lastEmitRef.current >= 3000) {
      lastEmitRef.current = now;
      emitLocation(gps.currentLocation.latitude, gps.currentLocation.longitude);
    }
  }, [gps.currentLocation, emitLocation]);

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

  const goToMyLocation = () => {
    const loc = gps.currentLocation ?? getLastLocation();
    if (!loc) {
      Alert.alert('위치 오류', '현재 위치를 확인할 수 없습니다.');
      return;
    }
    mapRef.current?.animateToRegion(
      { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500,
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        customMapStyle={Platform.OS === 'android' && isDark ? darkMapStyle : undefined}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
          if (fetchTimer.current) clearTimeout(fetchTimer.current);
          fetchTimer.current = setTimeout(() => fetchTerritories(r), 300);
        }}
        showsUserLocation={!(user && gps.currentLocation)}
        showsMyLocationButton={false}
      >
        {territories.map((t) => {
          const isMine = t.userId === user?.id;
          const color = isMine ? colors.primary : getUserColor(t.userId);
          const center = getCentroid(t.coordinates);
          return (
            <React.Fragment key={t.id}>
              <Polygon
                coordinates={t.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }))}
                fillColor={color + '40'}
                strokeColor={color}
                strokeWidth={isMine ? 3 : 2}
                tappable
                onPress={() => {
                  setSelectedTerritoryId(t.id);
                  setDetailVisible(true);
                }}
              />
              <Marker
                coordinate={center}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => {
                  setSelectedTerritoryId(t.id);
                  setDetailVisible(true);
                }}
              >
                <View style={{ alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, backgroundColor: color + 'CC', borderRadius: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }} numberOfLines={1}>
                    {t.name ?? `#${t.id}`}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600' }}>
                    {formatAreaCompact(t.areaSqm)}
                  </Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
        {nearbyUsers.map((u) => (
          <CharacterMarker
            key={u.userId}
            user={u}
            isMe={u.userId === user?.id}
          />
        ))}
        {gps.currentLocation && user && (
          <CharacterMarker
            key={rep ? `${rep.grade}-${rep.type}` : 'no-rep'}
            user={{
              userId: user.id,
              nickname: user.nickname,
              lat: gps.currentLocation.latitude,
              lng: gps.currentLocation.longitude,
              character: rep
                ? { name: rep.name, type: rep.type, grade: rep.grade, imageUrl: rep.imageUrl }
                : null,
            }}
            isMe
          />
        )}
      </MapView>

      {/* 상단 헤더 */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.overlay,
        paddingHorizontal: 16, paddingBottom: 12, paddingTop: insets.top + 8,
        ...mapCardShadow(isDark),
      }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          activeOpacity={0.7}
          onPress={() => setShowProfile(true)}
        >
          {rep ? (
            <View style={{
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: `${gradeColor[rep.grade]}20`,
              borderWidth: 2, borderColor: gradeColor[rep.grade],
              overflow: 'hidden',
            }}>
              <Image
                source={getCharacterImageSource(rep.grade, rep.type)}
                style={{
                  width: 36, height: 36,
                  transform: getCharacterImageTransform(rep.grade, rep.type, 36),
                }}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View style={{
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: colors.primary,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: colors.bg, fontSize: 15, fontWeight: '800' }}>{user?.nickname?.[0] ?? '?'}</Text>
            </View>
          )}
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{user?.nickname ?? '유저'}</Text>
        </TouchableOpacity>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: colors.goldDim,
          borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.gold }}>P</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.gold }}>{(user?.points ?? 0).toLocaleString()}</Text>
        </View>
      </View>

      {/* 프로필 팝업 */}
      <Modal transparent visible={showProfile} animationType="fade" onRequestClose={() => setShowProfile(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowProfile(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, width: '80%', alignItems: 'center', gap: 12 }}>
            {rep ? (
              <View style={{
                width: 56, height: 56, borderRadius: 20,
                backgroundColor: `${gradeColor[rep.grade]}20`,
                borderWidth: 2, borderColor: gradeColor[rep.grade],
                overflow: 'hidden',
              }}>
                <Image
                  source={getCharacterImageSource(rep.grade, rep.type)}
                  style={{
                    width: 56, height: 56,
                    transform: getCharacterImageTransform(rep.grade, rep.type, 56),
                  }}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={{
                width: 56, height: 56, borderRadius: 20,
                backgroundColor: colors.primary,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: colors.bg, fontSize: 22, fontWeight: '800' }}>{user?.nickname?.[0] ?? '?'}</Text>
              </View>
            )}

            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{user?.nickname ?? '유저'}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{user?.email}</Text>

            {rep && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: `${gradeColor[rep.grade]}15`,
                borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: gradeColor[rep.grade] }}>
                  {GRADE_LABEL[rep.grade]}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{rep.name}</Text>
              </View>
            )}

            <View style={{ width: '100%', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 10, marginTop: 4 }}>
              {[
                { label: '포인트', value: (user?.points ?? 0).toLocaleString(), color: colors.gold },
                { label: '스탯 포인트', value: String(user?.statPoints ?? 0), color: colors.primary },
                { label: '총 거리', value: `${(user?.totalDistance ?? 0).toFixed(1)} km`, color: colors.accent },
              ].map((row) => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>{row.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: row.color }}>{row.value}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={{ marginTop: 4, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: colors.card, borderRadius: radius.full }}
              onPress={() => setShowProfile(false)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>닫기</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 맵 컨트롤 */}
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
        <TouchableOpacity onPress={goToMyLocation} style={{
          width: 32, height: 32, backgroundColor: colors.overlayLight, opacity: 0.55,
          borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center',
          ...mapCardShadow(isDark),
        }}>
          <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* 하단 액션 */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 8,
      }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('러닝')}
          activeOpacity={0.85}
          style={{
            alignItems: 'center',
            backgroundColor: colors.primary, borderRadius: radius.xl,
            paddingVertical: 16,
          }}
        >
          <Text style={{ color: colors.bg, fontSize: 18, fontWeight: '800' }}>러닝 준비</Text>
        </TouchableOpacity>
      </View>

      <TerritoryDetailSheet
        visible={detailVisible}
        territoryId={selectedTerritoryId}
        territory={territories.find(t => t.id === selectedTerritoryId) ?? null}
        onClose={() => { setDetailVisible(false); setSelectedTerritoryId(null); }}
        onAttack={(id) => {
          const target = territories.find(t => t.id === id);
          setDetailVisible(false);
          setAttackTerritoryId(id);
          setAttackTerritoryName(target?.name ?? (target ? `영토 #${target.id}` : undefined));
          setAttackVisible(true);
        }}
      />

      <AttackTerritoryPanel
        visible={attackVisible}
        territoryId={attackTerritoryId}
        territoryName={attackTerritoryName}
        onClose={() => {
          setAttackVisible(false);
          setAttackTerritoryId(null);
          setAttackTerritoryName(undefined);
        }}
        onCompleted={() => {
          // 소켓 territory:update가 늦거나 끊긴 경우에도 결과 확인 후 지도 상태를 즉시 맞춘다.
          void fetchTerritories(regionRef.current);
        }}
      />
    </View>
  );
}
