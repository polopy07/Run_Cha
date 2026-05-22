import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  getTerritories,
  getTerritoryDetail,
  Territory,
  TerritoryDetail,
} from '../api/territory';
import useAuthStore from '../store/authStore';

type BottomTabParamList = {
  '홈': undefined;
  '캐릭터': undefined;
  '러닝': undefined;
  '랭킹': undefined;
  '메뉴': undefined;
};

type MapNav = BottomTabNavigationProp<BottomTabParamList, '홈'>;

const INITIAL_REGION = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const MOCK_RANKING = [
  { rank: 1, nickname: 'Runner_K', area: '235,600㎡' },
  { rank: 2, nickname: 'FastRun', area: '198,300㎡' },
  { rank: 3, nickname: 'RunMaster', area: '176,500㎡' },
];

const RANK_COLORS = ['#F1C40F', '#BDC3C7', '#CD7F32'];

const TERRITORY_STYLE = {
  mine: { stroke: '#2ECC71', fill: 'rgba(46,204,113,0.3)' },
  other: { stroke: '#E74C3C', fill: 'rgba(231,76,60,0.25)' },
};

function toBounds(region: Region) {
  const latHalf = region.latitudeDelta / 2;
  const lngHalf = region.longitudeDelta / 2;

  return {
    minLat: region.latitude - latHalf,
    maxLat: region.latitude + latHalf,
    minLng: region.longitude - lngHalf,
    maxLng: region.longitude + lngHalf,
  };
}

function toMapCoordinates(territory: Territory) {
  return territory.coordinates.map((coord) => ({
    latitude: coord.lat,
    longitude: coord.lng,
  }));
}

function centroid(coords: { latitude: number; longitude: number }[]) {
  return {
    latitude: coords.reduce((sum, coord) => sum + coord.latitude, 0) / coords.length,
    longitude: coords.reduce((sum, coord) => sum + coord.longitude, 0) / coords.length,
  };
}

function formatArea(areaSqm: number) {
  return `${Math.round(areaSqm).toLocaleString()}㎡`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
}

function typeLabel(type: string) {
  switch (type) {
    case 'attack':
      return '공격형';
    case 'defense':
      return '수비형';
    case 'buff':
      return '버프형';
    default:
      return type;
  }
}

function gradeLabel(grade: string) {
  switch (grade) {
    case 'common':
      return '일반';
    case 'rare':
      return '희귀';
    case 'epic':
      return '영웅';
    case 'legendary':
      return '전설';
    default:
      return grade;
  }
}

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MapNav>();
  const user = useAuthStore((state) => state.user);
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(INITIAL_REGION);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const loadTerritories = useCallback(async (region: Region) => {
    try {
      const data = await getTerritories(toBounds(region));
      setTerritories(data);
    } catch {
      setTerritories([]);
    }
  }, []);

  useEffect(() => {
    loadTerritories(INITIAL_REGION);
  }, [loadTerritories]);

  const openTerritoryDetail = async (territoryId: number) => {
    setIsDetailLoading(true);
    try {
      const data = await getTerritoryDetail(territoryId);
      setSelectedTerritory(data);
    } catch {
      Alert.alert('영토 조회 실패', '영토 정보를 불러오지 못했습니다.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const zoomIn = () => {
    const region = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: region.latitudeDelta * 0.5,
        longitudeDelta: region.longitudeDelta * 0.5,
      },
      200,
    );
  };

  const zoomOut = () => {
    const region = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: region.latitudeDelta * 2,
        longitudeDelta: region.longitudeDelta * 2,
      },
      200,
    );
  };

  const goToMyLocation = () => {
    const location = userLocationRef.current;
    if (!location) {
      Alert.alert('위치 오류', '현재 위치를 확인할 수 없습니다. 위치 권한을 허용했는지 확인해주세요.');
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500,
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={(region) => {
          regionRef.current = region;
          loadTerritories(region);
        }}
        onUserLocationChange={(event) => {
          const coordinate = event.nativeEvent.coordinate;
          if (!coordinate) return;
          const { latitude, longitude } = coordinate;
          userLocationRef.current = { latitude, longitude };
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {territories.map((territory) => {
          const coords = toMapCoordinates(territory);
          if (coords.length < 3) return null;

          const style = territory.userId === user?.id ? TERRITORY_STYLE.mine : TERRITORY_STYLE.other;
          const center = centroid(coords);

          return (
            <React.Fragment key={territory.id}>
              <Polygon
                coordinates={coords}
                strokeColor={style.stroke}
                strokeWidth={2}
                fillColor={style.fill}
                onPress={() => openTerritoryDetail(territory.id)}
              />
              <Marker
                coordinate={center}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => openTerritoryDetail(territory.id)}
              >
                <View style={[styles.territoryLabel, { borderColor: style.stroke }]}>
                  <Text style={styles.territoryLabelTitle}>
                    {territory.userId === user?.id ? '내 영토' : `유저 #${territory.userId}`}
                  </Text>
                  <Text style={styles.territoryLabelArea}>{formatArea(territory.areaSqm)}</Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.nickname?.[0] ?? 'R'}</Text>
          </View>
          <View>
            <Text style={styles.nickname}>{user?.nickname ?? 'Runner'}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statIcon}>P</Text>
            <Text style={styles.statValue}>{(user?.points ?? 0).toLocaleString()}</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn}>
            <Text style={styles.bellText}>알림</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.mapBtn} onPress={zoomIn}>
          <Text style={styles.mapBtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapBtn} onPress={zoomOut}>
          <Text style={styles.mapBtnText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mapBtn, styles.locationBtn]} onPress={goToMyLocation}>
          <Text style={styles.mapBtnText}>◎</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.miniRanking}>
        <Text style={styles.rankingTitle}>상위 랭킹 TOP 10</Text>
        {MOCK_RANKING.map((item, index) => (
          <View key={item.rank} style={styles.rankingRow}>
            <Text style={[styles.rankBadge, { color: RANK_COLORS[index] }]}>{item.rank}</Text>
            <Text style={styles.rankNickname}>{item.nickname}</Text>
            <Text style={styles.rankArea}>{item.area}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.actionButtons, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.startBtn]}
          onPress={() => navigation.navigate('러닝')}
        >
          <Text style={styles.actionBtnIcon}>러닝</Text>
          <View>
            <Text style={styles.actionBtnLabel}>러닝 시작</Text>
            <Text style={styles.actionBtnSub}>영토를 넓히러 가자!</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.nearbyBtn]}>
          <Text style={styles.actionBtnIcon}>전투</Text>
          <View>
            <Text style={styles.actionBtnLabel}>근처 유저</Text>
            <Text style={styles.actionBtnSub}>침략 가능한 유저 보기</Text>
          </View>
        </TouchableOpacity>
      </View>

      {isDetailLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#fff" />
        </View>
      )}

      <Modal
        visible={Boolean(selectedTerritory)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTerritory(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTerritory(null)}>
          <Pressable style={[styles.detailSheet, { paddingBottom: insets.bottom + 16 }]}>
            {selectedTerritory && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailTitle}>영토 #{selectedTerritory.id}</Text>
                    <Text style={styles.detailOwner}>
                      {selectedTerritory.owner.nickname} · {selectedTerritory.isMine ? '내 영토' : '다른 유저 영토'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedTerritory(null)}
                  >
                    <Text style={styles.closeBtnText}>닫기</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailStats}>
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatLabel}>면적</Text>
                    <Text style={styles.detailStatValue}>{formatArea(selectedTerritory.areaSqm)}</Text>
                  </View>
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatLabel}>점령률</Text>
                    <Text style={styles.detailStatValue}>{selectedTerritory.occupationRate}%</Text>
                  </View>
                </View>

                <View style={styles.detailInfoRow}>
                  <Text style={styles.detailInfoLabel}>최근 활동</Text>
                  <Text style={styles.detailInfoValue}>{formatDate(selectedTerritory.lastActiveAt)}</Text>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>배치 캐릭터</Text>
                  <Text style={styles.sectionCount}>{selectedTerritory.deployedCharacters.length}명</Text>
                </View>

                {selectedTerritory.deployedCharacters.length === 0 ? (
                  <Text style={styles.emptyText}>배치된 캐릭터가 없습니다.</Text>
                ) : (
                  selectedTerritory.deployedCharacters.map((character) => (
                    <View key={character.id} style={styles.characterRow}>
                      <View>
                        <Text style={styles.characterName}>{character.name}</Text>
                        <Text style={styles.characterMeta}>
                          {gradeLabel(character.grade)} · {typeLabel(character.type)}
                        </Text>
                      </View>
                      <Text style={styles.characterLevels}>
                        공 {character.attackLv} 방 {character.defenseLv} 속 {character.speedLv} 포 {character.pointLv}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2ECC71',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  nickname: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statIcon: { fontSize: 12, fontWeight: 'bold', color: '#F39C12' },
  statValue: { fontSize: 13, fontWeight: 'bold', color: '#1a1a1a' },
  bellBtn: { padding: 4 },
  bellText: { color: '#F39C12', fontWeight: 'bold' },
  territoryLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  territoryLabelTitle: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  territoryLabelArea: { color: '#ddd', fontSize: 10 },
  zoomControls: {
    position: 'absolute',
    right: 12,
    top: '40%',
  },
  mapBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#fff',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  locationBtn: { marginTop: 8 },
  mapBtnText: { fontSize: 20, color: '#333', lineHeight: 24 },
  miniRanking: {
    position: 'absolute',
    left: 12,
    bottom: 110,
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
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  startBtn: { backgroundColor: '#2ECC71' },
  nearbyBtn: { backgroundColor: '#E74C3C' },
  actionBtnIcon: { fontSize: 13, color: '#fff', fontWeight: 'bold' },
  actionBtnLabel: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  actionBtnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10 },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  detailSheet: {
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  detailOwner: { marginTop: 4, fontSize: 13, color: '#777' },
  closeBtn: {
    borderRadius: 6,
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeBtnText: { color: '#333', fontWeight: 'bold' },
  detailStats: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  detailStat: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    padding: 12,
  },
  detailStatLabel: { fontSize: 12, color: '#777', marginBottom: 4 },
  detailStatValue: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  detailInfoLabel: { fontSize: 13, color: '#777' },
  detailInfoValue: { flex: 1, textAlign: 'right', fontSize: 13, color: '#333' },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' },
  sectionCount: { fontSize: 13, color: '#777' },
  emptyText: {
    color: '#888',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 14,
    textAlign: 'center',
  },
  characterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    padding: 12,
    marginBottom: 8,
  },
  characterName: { fontSize: 14, fontWeight: 'bold', color: '#1a1a1a' },
  characterMeta: { marginTop: 3, fontSize: 12, color: '#777' },
  characterLevels: { fontSize: 12, color: '#333', fontWeight: '600' },
});
