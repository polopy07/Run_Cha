import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { radius } from '../../constants/theme';
import {
  canSubmitAttack,
  formatRunningLogLabel,
  getAttackCharacters,
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
  const { colors } = useTheme();
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

  const attackCharacters = useMemo(
    () => getAttackCharacters(characters),
    [characters],
  );

  const resetPanelState = useCallback(() => {
    setRunningLogs([]);
    setSelectedRunningLogId(null);
    setSelectedCharacterId(null);
    setResult(null);
    setIsSubmitting(false);
    setIsLoading(false);
  }, []);

  const loadAttackOptions = useCallback(async () => {
    setIsLoading(true);

    try {
      const [logs] = await Promise.all([
        getRunningLogs(),
        fetchCharacters(),
      ]);

      setRunningLogs(logs);
      setSelectedRunningLogId(logs[0]?.id ?? null);
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
      if (
        current !== null &&
        attackCharacters.some((character) => character.id === current)
      ) {
        return current;
      }

      return attackCharacters[0]?.id ?? null;
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
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    침략에 사용할 러닝 기록이 없습니다.
                  </Text>
                ) : (
                  runningLogs.map(log => {
                    const selected = selectedRunningLogId === log.id;
                    return (
                      <Pressable
                        key={log.id}
                        style={[
                          styles.option,
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
                        <Text style={[styles.optionTitle, { color: colors.text }]}>
                          {formatRunningLogLabel(log)}
                        </Text>
                        <Text
                          style={[
                            styles.optionMeta,
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
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    보유한 공격형 캐릭터가 없습니다.
                  </Text>
                ) : (
                  attackCharacters.map(character => {
                    const selected = selectedCharacterId === character.id;
                    return (
                      <Pressable
                        key={character.id}
                        style={[
                          styles.option,
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
                        <Text style={[styles.optionTitle, { color: colors.text }]}>
                          {character.name}
                        </Text>
                        <Text
                          style={[
                            styles.optionMeta,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {character.grade} · 공격 Lv.{character.attackLv}
                        </Text>
                      </Pressable>
                    );
                  })
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
                  <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                    점령률 {result.occupationRateBefore}% →{' '}
                    {result.occupationRateAfter}%
                  </Text>
                  <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                    획득 면적{' '}
                    {Math.round(result.acquiredAreaSqm).toLocaleString()}㎡
                  </Text>
                  <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                    남은 침략 횟수 {result.remainingDailyAttacks}회
                  </Text>
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
  emptyText: {
    paddingVertical: 12,
  },
  option: {
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionMeta: {
    marginTop: 4,
    fontSize: 12,
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
  resultText: {
    marginTop: 3,
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
