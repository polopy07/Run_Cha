import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import {
  getMyTerritories,
  updateTerritoryName,
  type Territory,
} from '../api/territory';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../constants/theme';
import type { MenuStackParamList } from '../navigation/MenuStack';

type Props = StackScreenProps<MenuStackParamList, 'MyTerritories'>;

function formatArea(areaSqm: number) {
  if (areaSqm >= 1_000_000) {
    return `${(areaSqm / 1_000_000).toFixed(2)} km²`;
  }
  return `${Math.round(areaSqm).toLocaleString()} m²`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${hour}:${minute}`;
}

function getTerritoryTitle(territory: Territory) {
  return territory.name?.trim() || `영토 #${territory.id}`;
}

export function MyTerritoriesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [nameInput, setNameInput] = useState('');

  const totalArea = useMemo(
    () => territories.reduce((sum, territory) => sum + territory.areaSqm, 0),
    [territories],
  );

  const loadTerritories = useCallback(async () => {
    try {
      const data = await getMyTerritories();
      setTerritories(data);
    } catch (error) {
      Alert.alert(
        '영토 조회 실패',
        error instanceof Error ? error.message : '보유 영토를 불러오지 못했습니다.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTerritories();
  }, [loadTerritories]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    loadTerritories();
  }, [loadTerritories]);

  const openNameModal = (territory: Territory) => {
    setSelectedTerritory(territory);
    setNameInput(territory.name ?? '');
  };

  const closeNameModal = () => {
    if (isSaving) return;
    setSelectedTerritory(null);
    setNameInput('');
  };

  const resetNameModal = () => {
    setSelectedTerritory(null);
    setNameInput('');
  };

  const applyTerritoryName = (id: number, name: string | null) => {
    setTerritories(current =>
      current.map(territory =>
        territory.id === id ? { ...territory, name } : territory,
      ),
    );
  };

  const saveName = async () => {
    if (!selectedTerritory) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('이름 입력', '영토 이름을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateTerritoryName(selectedTerritory.id, trimmed);
      applyTerritoryName(selectedTerritory.id, result.name);
      resetNameModal();
    } catch (error) {
      Alert.alert(
        '이름 변경 실패',
        error instanceof Error ? error.message : '영토 이름을 변경하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const clearName = async () => {
    if (!selectedTerritory) return;

    setIsSaving(true);
    try {
      const result = await updateTerritoryName(selectedTerritory.id, null);
      applyTerritoryName(selectedTerritory.id, result.name);
      resetNameModal();
    } catch (error) {
      Alert.alert(
        '이름 삭제 실패',
        error instanceof Error ? error.message : '영토 이름을 삭제하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderTerritory = ({ item }: { item: Territory }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.divider,
        borderRadius: radius.md,
        borderWidth: 1,
        padding: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
            {getTerritoryTitle(item)}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            ID {item.id}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => openNameModal(item)}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.primaryDim,
            borderRadius: radius.sm,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>
            이름 수정
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: spacing.lg,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          paddingTop: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>면적</Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 }}>
            {formatArea(item.areaSqm)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>점령률</Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 }}>
            {item.occupationRate}%
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>활동</Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 }}>
            {formatDate(item.lastActiveAt)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomColor: colors.divider,
          borderBottomWidth: 1,
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={{ color: colors.text, fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
            fontWeight: '800',
            marginLeft: 12,
          }}
        >
          내 영토 관리
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={territories}
          keyExtractor={item => String(item.id)}
          renderItem={renderTerritory}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 24,
            flexGrow: 1,
          }}
          ListHeaderComponent={
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderRadius: radius.lg,
                borderWidth: 1,
                marginBottom: spacing.lg,
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>보유 영토</Text>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 }}>
                {territories.length.toLocaleString()}개
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
                총 면적 {formatArea(totalArea)}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                paddingVertical: 80,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
                보유 영토가 없습니다
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
                러닝으로 폐곡선을 만들면 영토가 생성됩니다.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <Modal
        visible={selectedTerritory !== null}
        transparent
        animationType="fade"
        onRequestClose={closeNameModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={closeNameModal}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              borderRadius: radius.lg,
              borderWidth: 1,
              padding: 20,
            }}
            onPress={() => undefined}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              영토 이름 수정
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              maxLength={100}
              placeholder="영토 이름"
              placeholderTextColor={colors.textMuted}
              style={{
                borderColor: colors.divider,
                borderRadius: radius.md,
                borderWidth: 1,
                color: colors.text,
                fontSize: 16,
                marginTop: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSaving}
                onPress={clearName}
                style={{
                  backgroundColor: colors.dangerDim,
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '800' }}>
                  이름 삭제
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSaving}
                onPress={saveName}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.bg, fontSize: 14, fontWeight: '900' }}>
                  {isSaving ? '저장 중' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
