import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getRunningLogs, type RunningLogSummary } from '../../api/running';
import {
  attackTerritory,
  type AttackTerritoryResponse,
} from '../../api/territory';
import { useTheme } from '../../contexts/ThemeContext';
import useCharacterStore from '../../store/characterStore';
import { GRADE_LABEL, radius } from '../../constants/theme';
import {
  getCharacterImageSource,
  getCharacterImageTransform,
} from '../../assets/characters/characterImages';
import { formatAreaCompact } from '../../utils/formatUtils';
import {
  ATTACK_CHARACTER_SORT_OPTIONS,
  canSubmitAttack,
  formatAttackAvailableAt,
  formatRunningLogLabel,
  getSortedAttackCharacters,
  resolveSelectedAttackCharacterId,
  type AttackCharacterSortMode,
} from '../../utils/attackFlow';

type AttackTerritoryPanelProps = {
  visible: boolean;
  territoryId: number | null;
  territoryName?: string;
  onClose: () => void;
  onCompleted?: (result: AttackTerritoryResponse) => void;
};

export function AttackTerritoryPanel({
  visible,
  territoryId,
  territoryName,
  onClose,
  onCompleted,
}: AttackTerritoryPanelProps) {
  const { colors, gradeColor } = useTheme();
  const characters = useCharacterStore(state => state.characters);
  const fetchCharacters = useCharacterStore(state => state.fetchCharacters);
  const [runningLogs, setRunningLogs] = useState<RunningLogSummary[]>([]);
  const [selectedRunningLogId, setSelectedRunningLogId] = useState<number | null>(
    null,
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null,
  );
  const [result, setResult] = useState<AttackTerritoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attackSortMode, setAttackSortMode] =
    useState<AttackCharacterSortMode>('recent');
  const attackSortModeRef = useRef<AttackCharacterSortMode>(attackSortMode);

  const attackCharacters = useMemo(
    () => getSortedAttackCharacters(characters, attackSortMode),
    [attackSortMode, characters],
  );

  const resetPanelState = useCallback(() => {
    setRunningLogs([]);
    setSelectedRunningLogId(null);
    setSelectedCharacterId(null);
    setResult(null);
    setIsSubmitting(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    attackSortModeRef.current = attackSortMode;
  }, [attackSortMode]);

  const loadAttackOptions = useCallback(async () => {
    setIsLoading(true);

    try {
      const [logs] = await Promise.all([
        getRunningLogs(),
        fetchCharacters(),
      ]);

      setRunningLogs(logs);
      setSelectedRunningLogId(logs[0]?.id ?? null);
      setSelectedCharacterId(current => {
        const latestAttackCharacters = getSortedAttackCharacters(
          useCharacterStore.getState().characters,
          attackSortModeRef.current,
        );

        return resolveSelectedAttackCharacterId(
          latestAttackCharacters,
          current,
        );
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '침략 준비 정보를 불러오지 못했습니다.';
      Alert.alert('침략 준비 실패', message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCharacters]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setSelectedCharacterId((current) => {
      return resolveSelectedAttackCharacterId(attackCharacters, current);
    });
  }, [attackCharacters, visible]);

  useEffect(() => {
    if (visible && territoryId !== null) {
      resetPanelState();
      loadAttackOptions().catch(() => undefined);
    }
  }, [loadAttackOptions, resetPanelState, territoryId, visible]);

  const handleClose = useCallback(() => {
    resetPanelState();
    onClose();
  }, [onClose, resetPanelState]);

  const submitAttack = useCallback(async () => {
    if (territoryId === null) {
      Alert.alert('침략 불가', '침략할 영토를 먼저 선택해주세요.');
      return;
    }

    if (selectedRunningLogId === null || selectedCharacterId === null) {
      Alert.alert('침략 불가', '러닝 기록과 공격 캐릭터를 선택해주세요.');
      return;
    }

    const runningLogId = selectedRunningLogId;
    const attackerCharacterId = selectedCharacterId;

    setIsSubmitting(true);

    try {
      const attackResult = await attackTerritory(territoryId, {
        runningLogId,
        attackerCharacterId,
      });

      setResult(attackResult);
      onCompleted?.(attackResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '침략 요청에 실패했습니다.';
      Alert.alert('침략 실패', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [onCompleted, selectedCharacterId, selectedRunningLogId, territoryId]);

  const isSubmitDisabled =
    !canSubmitAttack(selectedRunningLogId, selectedCharacterId) ||
    isSubmitting ||
    result !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.panel, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                영토 침략
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {territoryName ?? '선택한 영토'}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>
                닫기
              </Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.danger} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                침략 정보를 불러오는 중
              </Text>
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  러닝 기록
                </Text>
                {runningLogs.length === 0 ? (
                  <Text
                    style={[
                      styles.emptyText,
                      styles.runningLogEmptyText,
                      { color: colors.textMuted },
                    ]}
                  >
                    침략에 사용할 러닝 기록이 없습니다.
                  </Text>
                ) : (
                  runningLogs.map(log => {
                    const selected = selectedRunningLogId === log.id;
                    return (
                      <Pressable
                        key={log.id}
                        style={[
                          styles.runningLogOption,
                          {
                            backgroundColor: selected
                              ? colors.dangerDim
                              : colors.card,
                            borderColor: selected
                              ? colors.danger
                              : colors.divider,
                          },
                        ]}
                        onPress={() => setSelectedRunningLogId(log.id)}
                        disabled={result !== null}
                      >
                        <Text
                          style={[styles.runningLogTitle, { color: colors.text }]}
                        >
                          {formatRunningLogLabel(log)}
                        </Text>
                        <Text
                          style={[
                            styles.runningLogMeta,
                            { color: colors.textSecondary },
                          ]}
                        >
                          포인트 {log.earnedPoints} · 면적{' '}
                          {Math.round(log.areaSqm).toLocaleString()}㎡
                        </Text>
                      </Pressable>
                    );
                  })
                )}

                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  공격 캐릭터
                </Text>
                {attackCharacters.length === 0 ? (
                  <View style={[styles.emptyBox, { borderColor: colors.divider }]}>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      공격형 캐릭터가 없습니다
                    </Text>
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      침략에는 공격형 캐릭터가 필요합니다. 캐릭터 뽑기에서
                      공격형 캐릭터를 획득해주세요.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.sortBar}>
                      {ATTACK_CHARACTER_SORT_OPTIONS.map(option => {
                        const selected = attackSortMode === option.value;

                        return (
                          <Pressable
                            key={option.value}
                            style={[
                              styles.sortButton,
                              {
                                backgroundColor: selected
                                  ? colors.danger
                                  : colors.card,
                                borderColor: selected
                                  ? colors.danger
                                  : colors.divider,
                              },
                            ]}
                            onPress={() => setAttackSortMode(option.value)}
                            disabled={result !== null}
                          >
                            <Text
                              style={[
                                styles.sortButtonText,
                                {
                                  color: selected
                                    ? colors.bg
                                    : colors.textSecondary,
                                },
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {attackCharacters.map(character => {
                      const selected = selectedCharacterId === character.id;
                      const gc = gradeColor[character.grade] ?? colors.textMuted;
                      return (
                        <Pressable
                          key={character.id}
                          style={[
                            styles.characterOption,
                            {
                              backgroundColor: selected
                                ? colors.dangerDim
                                : colors.card,
                              borderColor: selected
                                ? colors.danger
                                : colors.divider,
                            },
                          ]}
                          onPress={() => setSelectedCharacterId(character.id)}
                          disabled={result !== null}
                        >
                          <View
                            style={[
                              styles.characterImageBox,
                              { backgroundColor: colors.surface },
                            ]}
                          >
                            <Image
                              source={getCharacterImageSource(
                                character.grade,
                                character.type,
                              )}
                              style={[
                                styles.characterImage,
                                {
                                  transform: getCharacterImageTransform(
                                    character.grade,
                                    character.type,
                                    74,
                                  ),
                                },
                              ]}
                              resizeMode="contain"
                            />
                          </View>
                          <View style={styles.characterInfo}>
                            <View style={styles.characterTitleRow}>
                              <Text
                                style={[
                                  styles.characterName,
                                  { color: colors.text },
                                ]}
                                numberOfLines={1}
                              >
                                {character.name}
                              </Text>
                              <View
                                style={[
                                  styles.gradeBadge,
                                  { backgroundColor: `${gc}20` },
                                ]}
                              >
                                <Text style={[styles.gradeText, { color: gc }]}>
                                  {GRADE_LABEL[character.grade] ??
                                    character.grade}
                                </Text>
                              </View>
                            </View>
                            <Text
                              style={[
                                styles.characterMeta,
                                { color: colors.textSecondary },
                              ]}
                            >
                              공격형 · 캐릭터 Lv.{character.level ?? 1}
                            </Text>
                            <View style={styles.characterStats}>
                              <StatPill
                                label="공격"
                                value={character.attackLv ?? 1}
                                colors={colors}
                              />
                              <StatPill
                                label="방어"
                                value={character.defenseLv ?? 1}
                                colors={colors}
                              />
                              <StatPill
                                label="포인트"
                                value={character.pointLv ?? 1}
                                colors={colors}
                              />
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}
              </ScrollView>

              {result ? (
                <View
                  style={[
                    styles.resultBox,
                    {
                      backgroundColor: colors.primaryDim,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text style={[styles.resultTitle, { color: colors.text }]}>
                    {result.message}
                  </Text>
                  <Text
                    style={[
                      styles.resultSummary,
                      { color: colors.textSecondary },
                    ]}
                  >
                    점령률 {result.occupationRateBefore}% →{' '}
                    {result.occupationRateAfter}%
                  </Text>
                  <ResultRow
                    label="피해량"
                    value={Math.round(result.damage).toLocaleString()}
                    colors={colors}
                  />
                  <ResultRow
                    label="겹침 비율"
                    value={`${result.overlapRate.toFixed(1)}%`}
                    colors={colors}
                  />
                  <ResultRow
                    label="획득 면적"
                    value={formatAreaCompact(result.acquiredAreaSqm)}
                    colors={colors}
                  />
                  <ResultRow
                    label="남은 침략 횟수"
                    value={`${result.remainingDailyAttacks}회`}
                    colors={colors}
                  />
                  <ResultRow
                    label="다음 침략 가능"
                    value={formatAttackAvailableAt(
                      result.nextAttackAvailableAt,
                    )}
                    colors={colors}
                  />
                </View>
              ) : null}
            </>
          )}

          <Pressable
            style={[
              styles.submitButton,
              {
                backgroundColor: isSubmitDisabled
                  ? colors.divider
                  : colors.danger,
              },
            ]}
            onPress={submitAttack}
            disabled={isSubmitDisabled}
          >
            <Text
              style={[
                styles.submitButtonText,
                { color: isSubmitDisabled ? colors.textMuted : colors.bg },
              ]}
            >
              {isSubmitting ? '침략 요청 중' : result ? '침략 완료' : '침략하기'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function StatPill({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: colors.surface }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors.text }]}>Lv.{value}</Text>
    </View>
  );
}

function ResultRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.resultValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    maxHeight: '86%',
    padding: 18,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText: {
    fontWeight: '600',
  },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  content: {
    paddingBottom: 8,
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  sortBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  sortButton: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 4,
    lineHeight: 19,
  },
  runningLogEmptyText: {
    paddingVertical: 12,
  },
  runningLogOption: {
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  runningLogTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  runningLogMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  characterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  characterImageBox: {
    width: 72,
    height: 72,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  characterImage: {
    width: 82,
    height: 82,
  },
  characterInfo: {
    flex: 1,
    minWidth: 0,
  },
  characterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  characterName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '800',
  },
  gradeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  gradeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  characterMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  characterStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 9,
  },
  statPill: {
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  statValue: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  resultBox: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  resultTitle: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '700',
  },
  resultSummary: {
    marginTop: 3,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 7,
  },
  resultLabel: {
    fontSize: 13,
  },
  resultValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: 12,
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingVertical: 14,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
