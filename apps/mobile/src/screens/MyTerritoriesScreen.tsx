import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { deployCharacter } from '../api/character';
import {
  getMyTerritories,
  updateTerritoryName,
  type Territory,
} from '../api/territory';
import { radius, spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import type { MenuStackParamList } from '../navigation/MenuStack';
import useCharacterStore, { type Character } from '../store/characterStore';

type Props = StackScreenProps<MenuStackParamList, 'MyTerritories'>;

const TYPE_LABEL: Record<Character['type'], string> = {
  attack: '공격형',
  defense: '방어형',
  buff: '버프형',
};

const GRADE_LABEL: Record<Character['grade'], string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
};

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function canDeploy(character: Character) {
  return character.type === 'defense' || character.type === 'buff';
}

export function MyTerritoriesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { characters, fetchCharacters, updateCharacter } = useCharacterStore();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedTerritory, setSelectedTerritory] =
    useState<Territory | null>(null);
  const [namingTerritory, setNamingTerritory] = useState<Territory | null>(
    null,
  );
  const [nameInput, setNameInput] = useState('');

  const totalArea = useMemo(
    () => territories.reduce((sum, territory) => sum + territory.areaSqm, 0),
    [territories],
  );

  const deployableCharacters = useMemo(
    () =>
      characters.filter(
        character => canDeploy(character) && character.deployedTerritoryId === null,
      ),
    [characters],
  );

  const load = useCallback(async () => {
    try {
      const [territoryResult] = await Promise.all([
        getMyTerritories(),
        fetchCharacters(),
      ]);
      setTerritories(territoryResult);
    } catch (error) {
      Alert.alert(
        '영토 조회 실패',
        getErrorMessage(error, '보유 영토를 불러오지 못했습니다.'),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchCharacters]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    load().catch(() => undefined);
  }, [load]);

  const openNameModal = (territory: Territory) => {
    setNamingTerritory(territory);
    setNameInput(territory.name ?? '');
  };

  const closeNameModal = () => {
    if (isSavingName) return;
    setNamingTerritory(null);
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
    if (!namingTerritory) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('이름 입력', '영토 이름을 입력해주세요.');
      return;
    }

    setIsSavingName(true);
    try {
      const result = await updateTerritoryName(namingTerritory.id, trimmed);
      applyTerritoryName(namingTerritory.id, result.name);
      setNamingTerritory(null);
      setNameInput('');
    } catch (error) {
      Alert.alert(
        '이름 변경 실패',
        getErrorMessage(error, '영토 이름을 변경하지 못했습니다.'),
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const clearName = async () => {
    if (!namingTerritory) return;

    setIsSavingName(true);
    try {
      const result = await updateTerritoryName(namingTerritory.id, null);
      applyTerritoryName(namingTerritory.id, result.name);
      setNamingTerritory(null);
      setNameInput('');
    } catch (error) {
      Alert.alert(
        '이름 삭제 실패',
        getErrorMessage(error, '영토 이름을 삭제하지 못했습니다.'),
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const getDeployedCharacter = useCallback(
    (territoryId: number) =>
      characters.find(character => character.deployedTerritoryId === territoryId) ??
      null,
    [characters],
  );

  const submitDeploy = async (character: Character) => {
    if (!selectedTerritory || isDeploying) return;

    setIsDeploying(true);
    try {
      const updated = await deployCharacter(character.id, selectedTerritory.id);
      updateCharacter(updated);
      setSelectedTerritory(null);
      Alert.alert('배치 완료', `${character.name}을 배치했습니다.`);
    } catch (error) {
      Alert.alert(
        '배치 실패',
        getErrorMessage(error, '캐릭터를 배치하지 못했습니다.'),
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const submitUndeploy = async (character: Character) => {
    if (isDeploying) return;

    setIsDeploying(true);
    try {
      const updated = await deployCharacter(character.id, null);
      updateCharacter(updated);
      setSelectedTerritory(null);
      Alert.alert('회수 완료', `${character.name}을 회수했습니다.`);
    } catch (error) {
      Alert.alert(
        '회수 실패',
        getErrorMessage(error, '캐릭터를 회수하지 못했습니다.'),
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const renderTerritory = ({ item }: { item: Territory }) => {
    const deployedCharacter = getDeployedCharacter(item.id);

    return (
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
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}
            >
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
            <Text
              style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}
            >
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
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              {formatArea(item.areaSqm)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>점령률</Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              {item.occupationRate}%
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>활동</Text>
            <Text
              style={{
                color: colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              {formatDate(item.lastActiveAt)}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.sm,
            marginTop: spacing.md,
            padding: spacing.md,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            배치 캐릭터
          </Text>
          {deployedCharacter ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: spacing.md,
                marginTop: 6,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: '800',
                  }}
                >
                  {deployedCharacter.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {TYPE_LABEL[deployedCharacter.type]} /{' '}
                  {GRADE_LABEL[deployedCharacter.grade]}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => submitUndeploy(deployedCharacter)}
                style={{
                  backgroundColor: colors.dangerDim,
                  borderRadius: radius.full,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontSize: 12,
                    fontWeight: '800',
                  }}
                >
                  회수
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
              배치된 캐릭터가 없습니다
            </Text>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={deployedCharacter !== null || isDeploying}
          onPress={() => setSelectedTerritory(item)}
          style={{
            backgroundColor:
              deployedCharacter !== null ? colors.divider : colors.primary,
            borderRadius: radius.md,
            marginTop: spacing.md,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: deployedCharacter !== null ? colors.textMuted : colors.bg,
              fontSize: 14,
              fontWeight: '900',
            }}
          >
            {deployedCharacter !== null ? '배치 중' : '캐릭터 배치'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

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
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                보유 영토
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 28,
                  fontWeight: '900',
                  marginTop: 4,
                }}
              >
                {territories.length.toLocaleString()}개
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  marginTop: 8,
                }}
              >
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
              <Text
                style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}
              >
                보유 영토가 없습니다
              </Text>
              <Text
                style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}
              >
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
        visible={namingTerritory !== null}
        transparent
        animationType="fade"
        onRequestClose={closeNameModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
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
                disabled={isSavingName}
                onPress={clearName}
                style={{
                  backgroundColor: colors.dangerDim,
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: isSavingName ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ color: colors.danger, fontSize: 14, fontWeight: '800' }}
                >
                  이름 삭제
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSavingName}
                onPress={saveName}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  flex: 1,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: isSavingName ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ color: colors.bg, fontSize: 14, fontWeight: '900' }}
                >
                  {isSavingName ? '저장 중' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={selectedTerritory !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !isDeploying && setSelectedTerritory(null)}
      >
        <Pressable
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          onPress={() => !isDeploying && setSelectedTerritory(null)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: 20,
              paddingBottom: insets.bottom + 20,
            }}
            onPress={() => undefined}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.divider,
                alignSelf: 'center',
                marginBottom: 14,
              }}
            />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              캐릭터 배치
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {selectedTerritory ? getTerritoryTitle(selectedTerritory) : ''}
            </Text>

            {deployableCharacters.length === 0 ? (
              <Text
                style={{
                  color: colors.textMuted,
                  textAlign: 'center',
                  paddingVertical: 32,
                }}
              >
                배치 가능한 수비형/버프형 캐릭터가 없습니다.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 360, marginTop: 16 }}>
                {deployableCharacters.map(character => (
                  <TouchableOpacity
                    key={character.id}
                    activeOpacity={0.85}
                    disabled={isDeploying}
                    onPress={() => submitDeploy(character)}
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.divider,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      marginBottom: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 15,
                        fontWeight: '800',
                      }}
                    >
                      {character.name}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        marginTop: 3,
                      }}
                    >
                      {TYPE_LABEL[character.type]} / {GRADE_LABEL[character.grade]} ·
                      ATK {character.attackLv} · DEF {character.defenseLv} · PT{' '}
                      {character.pointLv}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
