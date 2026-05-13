import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';

const INITIAL_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const MOCK_USER = { nickname: 'Runner123', level: 28, points: 12450, diamonds: 350 };

const MOCK_TERRITORIES = [
  {
    id: 1,
    type: 'mine' as const,
    label: '내 땅',
    area: '125,830㎡',
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
    id: 2,
    type: 'enemy' as const,
    label: '상대 유저',
    area: '85,400㎡',
    coords: [
      { latitude: 37.5695, longitude: 126.9825 },
      { latitude: 37.5715, longitude: 126.9845 },
      { latitude: 37.5708, longitude: 126.987 },
      { latitude: 37.5688, longitude: 126.9865 },
      { latitude: 37.5678, longitude: 126.984 },
    ],
  },
  {
    id: 3,
    type: 'neutral' as const,
    label: '중립 지역',
    area: '45,220㎡',
    coords: [
      { latitude: 37.5648, longitude: 126.98 },
      { latitude: 37.5665, longitude: 126.982 },
      { latitude: 37.5658, longitude: 126.9848 },
      { latitude: 37.5638, longitude: 126.9845 },
      { latitude: 37.5632, longitude: 126.9818 },
    ],
  },
];

const TERRITORY_STYLE = {
  mine:    { stroke: '#2ECC71', fill: 'rgba(46,204,113,0.3)' },
  enemy:   { stroke: '#E74C3C', fill: 'rgba(231,76,60,0.25)' },
  neutral: { stroke: '#95A5A6', fill: 'rgba(149,165,166,0.25)' },
};

const MOCK_RANKING = [
  { rank: 1, nickname: 'Runner_K',  area: '235,600㎡' },
  { rank: 2, nickname: 'FastRun',   area: '198,300㎡' },
  { rank: 3, nickname: 'RunMaster', area: '176,500㎡' },
];

const RANK_COLORS = ['#F1C40F', '#BDC3C7', '#CD7F32'];

function centroid(coords: { latitude: number; longitude: number }[]) {
  return {
    latitude:  coords.reduce((s, c) => s + c.latitude, 0)  / coords.length,
    longitude: coords.reduce((s, c) => s + c.longitude, 0) / coords.length,
  };
}

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef(INITIAL_REGION);

  const zoomIn = () => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
      { ...r, latitudeDelta: r.latitudeDelta * 0.5, longitudeDelta: r.longitudeDelta * 0.5 },
      200,
    );
  };

  const zoomOut = () => {
    const r = regionRef.current;
    mapRef.current?.animateToRegion(
      { ...r, latitudeDelta: r.latitudeDelta * 2, longitudeDelta: r.longitudeDelta * 2 },
      200,
    );
  };

  const goToMyLocation = () => {
    Geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.animateToRegion(
          { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          500,
        );
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 },
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={r => { regionRef.current = r; }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {MOCK_TERRITORIES.map(t => {
          const s = TERRITORY_STYLE[t.type];
          return (
            <React.Fragment key={t.id}>
              <Polygon
                coordinates={t.coords}
                strokeColor={s.stroke}
                strokeWidth={2}
                fillColor={s.fill}
              />
              <Marker coordinate={centroid(t.coords)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={[styles.territoryLabel, { borderColor: s.stroke }]}>
                  <Text style={styles.territoryLabelTitle}>{t.label}</Text>
                  <Text style={styles.territoryLabelArea}>{t.area}</Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{MOCK_USER.nickname[0]}</Text>
          </View>
          <View>
            <Text style={styles.nickname}>{MOCK_USER.nickname}</Text>
            <Text style={styles.level}>Lv. {MOCK_USER.level}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statIcon}>P</Text>
            <Text style={styles.statValue}>{MOCK_USER.points.toLocaleString()}</Text>
          </View>
          <View style={styles.statBadge}>
            <Text style={styles.statIcon}>💎</Text>
            <Text style={styles.statValue}>{MOCK_USER.diamonds}</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 줌 / 위치 버튼 */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.mapBtn} onPress={zoomIn}>
          <Text style={styles.mapBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapBtn} onPress={zoomOut}>
          <Text style={styles.mapBtnText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mapBtn, { marginTop: 8 }]} onPress={goToMyLocation}>
          <Text style={styles.mapBtnText}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* 미니 랭킹 */}
      <View style={styles.miniRanking}>
        <Text style={styles.rankingTitle}>상위 랭킹 TOP 10</Text>
        {MOCK_RANKING.map((item, i) => (
          <View key={item.rank} style={styles.rankingRow}>
            <Text style={[styles.rankBadge, { color: RANK_COLORS[i] }]}>{item.rank}</Text>
            <Text style={styles.rankNickname}>{item.nickname}</Text>
            <Text style={styles.rankArea}>{item.area}</Text>
          </View>
        ))}
      </View>

      {/* 하단 버튼 */}
      <View style={[styles.actionButtons, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.startBtn]}
          onPress={() => navigation.navigate('러닝' as never)}
        >
          <Text style={styles.actionBtnIcon}>🏃</Text>
          <View>
            <Text style={styles.actionBtnLabel}>러닝 시작</Text>
            <Text style={styles.actionBtnSub}>영토를 넓히러 가자!</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.nearbyBtn]}>
          <Text style={styles.actionBtnIcon}>⚔️</Text>
          <View>
            <Text style={styles.actionBtnLabel}>근처 유저</Text>
            <Text style={styles.actionBtnSub}>침략 가능한 유저 보기</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // 헤더
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2ECC71',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  nickname: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  level: { fontSize: 12, color: '#888' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F5F5', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  statIcon: { fontSize: 12, fontWeight: 'bold', color: '#F39C12' },
  statValue: { fontSize: 13, fontWeight: 'bold', color: '#1a1a1a' },
  bellBtn: { padding: 4 },

  // 영토 라벨
  territoryLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4,
    alignItems: 'center',
  },
  territoryLabelTitle: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  territoryLabelArea: { color: '#ddd', fontSize: 10 },

  // 줌 버튼
  zoomControls: {
    position: 'absolute',
    right: 12, top: '40%',
  },
  mapBtn: {
    width: 36, height: 36,
    backgroundColor: '#fff',
    borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  mapBtnText: { fontSize: 20, color: '#333', lineHeight: 24 },

  // 미니 랭킹
  miniRanking: {
    position: 'absolute',
    left: 12, bottom: 110,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 10,
    padding: 12,
    minWidth: 180,
  },
  rankingTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  rankBadge: { fontSize: 13, fontWeight: 'bold', width: 16 },
  rankNickname: { color: '#fff', fontSize: 12, flex: 1 },
  rankArea: { color: '#aaa', fontSize: 11 },

  // 하단 버튼
  actionButtons: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  startBtn:  { backgroundColor: '#2ECC71' },
  nearbyBtn: { backgroundColor: '#E74C3C' },
  actionBtnIcon: { fontSize: 22 },
  actionBtnLabel: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  actionBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
});
