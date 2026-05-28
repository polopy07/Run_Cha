import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../contexts/ThemeContext';
import { radius, mapCardShadow } from '../constants/theme';

type BottomTabParamList = {
  '홈': undefined; '캐릭터': undefined; '러닝': undefined; '랭킹': undefined; '메뉴': undefined;
};
type MapNav = BottomTabNavigationProp<BottomTabParamList, '홈'>;

const INITIAL_REGION = {
  latitude: 37.5665, longitude: 126.978,
  latitudeDelta: 0.02, longitudeDelta: 0.02,
};

const MOCK_USER = { nickname: 'Runner123', points: 12450 };

const MOCK_TERRITORIES = [
  {
    id: 1, type: 'mine' as const, label: '내 영토', area: '125,830㎡',
    coords: [
      { latitude: 37.5685, longitude: 126.9755 },
      { latitude: 37.5705, longitude: 126.9775 },
      { latitude: 37.57, longitude: 126.981 },
      { latitude: 37.5675, longitude: 126.982 },
      { latitude: 37.5655, longitude: 126.9795 },
      { latitude: 37.566, longitude: 126.9765 },
    ],
  },
  {
    id: 2, type: 'enemy' as const, label: '상대 유저', area: '85,400㎡',
    coords: [
      { latitude: 37.5695, longitude: 126.9825 },
      { latitude: 37.5715, longitude: 126.9845 },
      { latitude: 37.5708, longitude: 126.987 },
      { latitude: 37.5688, longitude: 126.9865 },
      { latitude: 37.5678, longitude: 126.984 },
    ],
  },
  {
    id: 3, type: 'neutral' as const, label: '중립 지역', area: '45,220㎡',
    coords: [
      { latitude: 37.5648, longitude: 126.98 },
      { latitude: 37.5665, longitude: 126.982 },
      { latitude: 37.5658, longitude: 126.9848 },
      { latitude: 37.5638, longitude: 126.9845 },
      { latitude: 37.5632, longitude: 126.9818 },
    ],
  },
];

const MOCK_RANKING = [
  { rank: 1, nickname: 'Runner_K',  area: '235,600㎡' },
  { rank: 2, nickname: 'FastRun',   area: '198,300㎡' },
  { rank: 3, nickname: 'RunMaster', area: '176,500㎡' },
];

const RANK_COLORS = ['#FFB300', '#B0B0C0', '#CD7F32'];

function centroid(coords: { latitude: number; longitude: number }[]) {
  return {
    latitude: coords.reduce((s, c) => s + c.latitude, 0) / coords.length,
    longitude: coords.reduce((s, c) => s + c.longitude, 0) / coords.length,
  };
}

export function MapScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MapNav>();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef(INITIAL_REGION);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const TERRITORY_STYLE = {
    mine:    { stroke: colors.primary, fill: colors.primaryDim },
    enemy:   { stroke: colors.danger, fill: colors.dangerDim },
    neutral: { stroke: colors.textMuted, fill: 'rgba(94,94,122,0.15)' },
  };

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
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={(r) => { regionRef.current = r; }}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) userLocationRef.current = { latitude: c.latitude, longitude: c.longitude };
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {MOCK_TERRITORIES.map((t) => {
          const s = TERRITORY_STYLE[t.type];
          return (
            <React.Fragment key={t.id}>
              <Polygon coordinates={t.coords} strokeColor={s.stroke} strokeWidth={2} fillColor={s.fill} />
              <Marker coordinate={centroid(t.coords)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={{
                  backgroundColor: colors.overlay, borderRadius: 8,
                  paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center',
                }}>
                  <Text style={{ color: colors.text, fontSize: 10, fontWeight: '700' }}>{t.label}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 9 }}>{t.area}</Text>
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
            <Text style={{ color: colors.bg, fontSize: 15, fontWeight: '800' }}>{MOCK_USER.nickname[0]}</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{MOCK_USER.nickname}</Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: colors.goldDim,
          borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.gold }}>P</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.gold }}>{MOCK_USER.points.toLocaleString()}</Text>
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

      {/* 미니 랭킹 */}
      <View style={{
        position: 'absolute', left: 12, bottom: 100,
        backgroundColor: colors.overlay,
        borderRadius: radius.md, padding: 12, minWidth: 170,
        borderWidth: isDark ? 1 : 0, borderColor: colors.divider,
        ...mapCardShadow(isDark),
      }}>
        <Text style={{ color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 }}>TOP 3</Text>
        {MOCK_RANKING.map((item, i) => (
          <View key={item.rank} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', width: 14, textAlign: 'center', color: RANK_COLORS[i] }}>{item.rank}</Text>
            <Text style={{ color: colors.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{item.nickname}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.area}</Text>
          </View>
        ))}
      </View>

      {/* 하단 액션 */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', paddingHorizontal: 12, gap: 8,
        paddingBottom: insets.bottom + 8,
      }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('러닝')}
          activeOpacity={0.85}
          style={{
            flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: colors.primary, borderRadius: radius.lg,
            paddingVertical: 14, paddingHorizontal: 18,
          }}
        >
          <View>
            <Text style={{ color: colors.bg, fontSize: 15, fontWeight: '800' }}>러닝 시작</Text>
            <Text style={{ color: 'rgba(11,11,20,0.6)', fontSize: 11, marginTop: 2 }}>영토를 넓히러 가자</Text>
          </View>
          <Text style={{ color: colors.bg, fontSize: 20, fontWeight: '700' }}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} style={{
          flex: 1, backgroundColor: colors.overlay, borderRadius: radius.lg,
          justifyContent: 'center', alignItems: 'center',
          borderWidth: isDark ? 1 : 0, borderColor: colors.divider,
          ...mapCardShadow(isDark),
        }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>근처 유저</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
