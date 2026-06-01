import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getTerritoryDetail,
  updateTerritoryName,
  type TerritoryDetail,
  type TerritoryDeployedCharacter,
} from '../api/territory';
import { useTheme } from '../contexts/ThemeContext';
import { radius, GRADE_LABEL } from '../constants/theme';

type Props = {
  visible: boolean;
  territoryId: number | null;
  onClose: () => void;
  onAttack?: (territoryId: number) => void;
};

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) return `${(sqm / 1_000_000).toFixed(2)} km²`;
  return `${Math.round(sqm).toLocaleString()} m²`;
}

function gradeColor(grade: string, colors: ReturnType<typeof useTheme>['colors']): string {
  const map: Record<string, string> = {
    common: colors.gradeCommon,
    rare: colors.gradeRare,
    epic: colors.gradeEpic,
    legendary: colors.gradeLegendary,
  };
  return map[grade] ?? colors.textMuted;
}

function CharacterCard({ char, colors }: { char: TerritoryDeployedCharacter; colors: ReturnType<typeof useTheme>['colors'] }) {
  const gc = gradeColor(char.grade, colors);
  const typeLabel = char.type === 'defense' ? '수비' : char.type === 'buff' ? '버프' : '공격';

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderLeftWidth: 3,
      borderLeftColor: gc,
      padding: 12,
      marginBottom: 8,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{char.name}</Text>
          <View style={{ backgroundColor: gc + '25', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: gc, fontSize: 11, fontWeight: '700' }}>{GRADE_LABEL[char.grade] ?? char.grade}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>{typeLabel}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatBadge label="ATK" value={char.attackLv} colors={colors} />
        <StatBadge label="DEF" value={char.defenseLv} colors={colors} />
        <StatBadge label="SPD" value={char.speedLv} colors={colors} />
        <StatBadge label="PNT" value={char.pointLv} colors={colors} />
      </View>
    </View>
  );
}

function StatBadge({ label, value, colors }: { label: string; value: number; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>Lv.{value}</Text>
    </View>
  );
}

export function TerritoryDetailSheet({ visible, territoryId, onClose, onAttack }: Props) {
  const { colors } = useTheme();
  const [detail, setDetail] = useState<TerritoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!visible || territoryId == null) {
      setDetail(null);
      setEditingName(false);
      return;
    }
    setLoading(true);
    getTerritoryDetail(territoryId)
      .then(setDetail)
      .catch(() => Alert.alert('오류', '영토 정보를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [visible, territoryId]);

  const handleSaveName = async () => {
    if (!detail || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const res = await updateTerritoryName(detail.id, nameInput.trim());
      setDetail(prev => prev ? { ...prev, name: res.name } : prev);
      setEditingName(false);
    } catch {
      Alert.alert('오류', '이름 변경에 실패했습니다.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>

      <View style={{
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
        maxHeight: '70%',
      }}>
        <View style={{ width: 40, height: 4, backgroundColor: colors.divider, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {!loading && detail && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 영토 이름 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {editingName ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: '700',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.primary,
                      paddingVertical: 4,
                    }}
                    value={nameInput}
                    onChangeText={setNameInput}
                    maxLength={50}
                    autoFocus
                    placeholder="영토 이름"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity onPress={handleSaveName} disabled={savingName}>
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                      {savingName ? '...' : '저장'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingName(false)}>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>취소</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
                    {detail.name ?? `영토 #${detail.id}`}
                  </Text>
                  {detail.isMine && (
                    <TouchableOpacity onPress={() => { setNameInput(detail.name ?? ''); setEditingName(true); }}>
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>이름 수정</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            {/* 보유자 */}
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
              {detail.isMine ? '내 영토' : `보유자: ${detail.owner.nickname}`}
            </Text>

            {/* 면적 / 점령률 */}
            <View style={{
              flexDirection: 'row', gap: 12, marginBottom: 16,
            }}>
              <View style={{
                flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
                padding: 14, alignItems: 'center',
              }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>면적</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{formatArea(detail.areaSqm)}</Text>
              </View>
              <View style={{
                flex: 1, backgroundColor: colors.surface, borderRadius: radius.md,
                padding: 14, alignItems: 'center',
              }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>점령률</Text>
                <Text style={{
                  color: detail.occupationRate > 50 ? colors.primary : colors.danger,
                  fontSize: 16, fontWeight: '800',
                }}>
                  {detail.occupationRate}%
                </Text>
              </View>
            </View>

            {/* 배치 캐릭터 */}
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              배치된 캐릭터 {detail.deployedCharacters.length > 0 ? `(${detail.deployedCharacters.length})` : ''}
            </Text>

            {detail.deployedCharacters.length === 0 ? (
              <View style={{
                backgroundColor: colors.surface, borderRadius: radius.md,
                padding: 20, alignItems: 'center', marginBottom: 16,
              }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>배치된 캐릭터가 없습니다</Text>
              </View>
            ) : (
              <View style={{ marginBottom: 16 }}>
                {detail.deployedCharacters.map(c => (
                  <CharacterCard key={c.id} char={c} colors={colors} />
                ))}
              </View>
            )}

            {/* 액션 버튼 */}
            {!detail.isMine && onAttack && (
              <TouchableOpacity
                onPress={() => onAttack(detail.id)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.danger,
                  borderRadius: radius.lg,
                  paddingVertical: 14,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>침략하기</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '700' }}>닫기</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
