import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import MapView, { Polygon, PROVIDER_GOOGLE, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { radius, mapCardShadow, GRADE_LABEL } from '../constants/theme';
import { darkMapStyle } from '../constants/mapStyle';
import useAuthStore from '../store/authStore';
import { getTerritories, type Territory } from '../api/territory';
import { useSocket } from '../hooks/useSocket';
import { CharacterMarker } from '../components/CharacterMarker';

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getUserColor(userId: number | undefined): string {
  if (userId == null) return '#888888';
  const hue = (userId * 137.508) % 360;
  return hslToHex(hue, 70, 55);
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
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const user = useAuthStore(s => s.user);
  const rep = user?.representativeCharacter ?? null;
  const { nearbyUsers, emitLocation } = useSocket({
    onTerritoryUpdate: () => fetchTerritories(regionRef.current),
  });
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [showProfile, setShowProfile] = useState(false);

  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTerritories = useCallback(async (region: Region) => {
    const bounds = {
      minLat: region.latitude - region.latitudeDelta / 2,
      maxLat: region.latitude + region.latitudeDelta / 2,
      minLng: region.longitude - region.longitudeDelta / 2,
      maxLng: region.longitude + region.longitudeDelta / 2,
    };
    try {
      const data = await getTerritories(bounds);
      setTerritories(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchTerritories(INITIAL_REGION);
  }, [fetchTerritories]);

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
    const loc = userLocationRef.current;
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
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (!c) return;
          userLocationRef.current = { latitude: c.latitude, longitude: c.longitude };
          emitLocation(c.latitude, c.longitude);
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {territories.map((t) => {
          const isMine = t.userId === user?.id;
          const color = isMine ? colors.primary : getUserColor(t.userId);
          return (
            <Polygon
              key={t.id}
              coordinates={t.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }))}
              fillColor={color + '40'}
              strokeColor={color}
              strokeWidth={isMine ? 3 : 2}
            />
          );
        })}
        {nearbyUsers.map((u) => (
          <CharacterMarker
            key={u.userId}
            user={u}
            isMe={u.userId === user?.id}
          />
        ))}
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
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: gradeColor[rep.grade], fontSize: 12, fontWeight: '800' }}>
                {rep.type === 'attack' ? 'ATK' : rep.type === 'defense' ? 'DEF' : 'BUF'}
              </Text>
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
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: gradeColor[rep.grade], fontSize: 18, fontWeight: '800' }}>
                  {rep.type === 'attack' ? 'ATK' : rep.type === 'defense' ? 'DEF' : 'BUF'}
                </Text>
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
            width: 40, height: 40, backgroundColor: colors.overlayLight,
            borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center', marginBottom: 4,
            ...mapCardShadow(isDark),
          }}>
            <Text style={{ fontSize: 20, color: colors.text, fontWeight: '600' }}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 8 }} />
        <TouchableOpacity onPress={goToMyLocation} style={{
          width: 40, height: 40, backgroundColor: colors.overlayLight,
          borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center',
          ...mapCardShadow(isDark),
        }}>
          <Text style={{ fontSize: 20, color: colors.text, fontWeight: '600' }}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* 하단 액션 */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 12,
        paddingBottom: insets.bottom + 8,
      }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('러닝')}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary, borderRadius: radius.lg,
            paddingVertical: 16,
          }}
        >
          <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '800' }}>러닝 시작</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
