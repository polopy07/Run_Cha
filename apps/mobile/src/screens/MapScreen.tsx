import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { radius, mapCardShadow } from '../constants/theme';
import { darkMapStyle } from '../constants/mapStyle';
import useAuthStore from '../store/authStore';
import { getTerritories, type Territory } from '../api/territory';
import { TerritoryDetailSheet } from '../components/TerritoryDetailSheet';
import { AttackTerritoryPanel } from '../components/attack/AttackTerritoryPanel';

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

function getCentroid(coords: { lat: number; lng: number }[]): { latitude: number; longitude: number } {
  const len = coords.length || 1;
  const sum = coords.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
  return { latitude: sum.lat / len, longitude: sum.lng / len };
}

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(1)}km²`;
  if (sqm >= 10_000) return `${(sqm / 10_000).toFixed(1)}만m²`;
  return `${Math.round(sqm).toLocaleString()}m²`;
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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MapNav>();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef(INITIAL_REGION);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const initialMoveDone = useRef(false);
  const user = useAuthStore(s => s.user);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [attackTerritoryId, setAttackTerritoryId] = useState<number | null>(null);
  const [attackVisible, setAttackVisible] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      fetchTerritories(regionRef.current);
    }, [fetchTerritories]),
  );

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
          if (!initialMoveDone.current) {
            initialMoveDone.current = true;
            const region = { latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
            mapRef.current?.animateToRegion(region, 500);
            fetchTerritories(region);
          }
        }}
        showsUserLocation
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
                    {formatArea(t.areaSqm)}
                  </Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* 상단 헤더 */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: colors.overlay,
        paddingHorizontal: 16, paddingBottom: 12, paddingTop: insets.top + 8,
        ...mapCardShadow(isDark),
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.primary,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ color: colors.bg, fontSize: 15, fontWeight: '800' }}>{user?.nickname?.[0] ?? '?'}</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{user?.nickname ?? '유저'}</Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: colors.goldDim,
          borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.gold }}>P</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.gold }}>{(user?.points ?? 0).toLocaleString()}</Text>
        </View>
      </View>

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

      <TerritoryDetailSheet
        visible={detailVisible}
        territoryId={selectedTerritoryId}
        territory={territories.find(t => t.id === selectedTerritoryId) ?? null}
        onClose={() => { setDetailVisible(false); setSelectedTerritoryId(null); }}
        onAttack={(id) => {
          setDetailVisible(false);
          setAttackTerritoryId(id);
          setAttackVisible(true);
        }}
      />

      <AttackTerritoryPanel
        visible={attackVisible}
        territoryId={attackTerritoryId}
        onClose={() => { setAttackVisible(false); setAttackTerritoryId(null); }}
        onCompleted={() => {
          setAttackVisible(false);
          setAttackTerritoryId(null);
          fetchTerritories(regionRef.current);
        }}
      />
    </View>
  );
}
