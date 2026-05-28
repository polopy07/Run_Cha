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
import { getCharacters } from '../../api/character';
import { getRunningLogs, type RunningLogSummary } from '../../api/running';
import {
  attackTerritory,
  type AttackTerritoryResponse,
} from '../../api/territory';
import type { Character } from '../../store/characterStore';
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
  const [runningLogs, setRunningLogs] = useState<RunningLogSummary[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
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

  const loadAttackOptions = useCallback(async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const [logs, characterList] = await Promise.all([
        getRunningLogs(),
        getCharacters(),
      ]);
      const attackOnly = getAttackCharacters(characterList);

      setRunningLogs(logs);
      setCharacters(characterList);
      setSelectedRunningLogId(logs[0]?.id ?? null);
      setSelectedCharacterId(attackOnly[0]?.id ?? null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '침략 준비 정보를 불러오지 못했습니다.';
      Alert.alert('침략 준비 실패', message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && territoryId !== null) {
      loadAttackOptions().catch(() => undefined);
    }
  }, [loadAttackOptions, territoryId, visible]);

  const submitAttack = async () => {
    if (territoryId === null) {
      Alert.alert('침략 불가', '침략할 영토를 먼저 선택해주세요.');
      return;
    }

    if (selectedRunningLogId === null || selectedCharacterId === null) {
      Alert.alert('침략 불가', '러닝 기록과 공격형 캐릭터를 선택해주세요.');
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
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>영토 침략</Text>
              <Text style={styles.subtitle}>
                {territoryName ?? '선택한 영토'}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#E74C3C" />
              <Text style={styles.loadingText}>침략 정보를 불러오는 중</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.sectionTitle}>러닝 기록</Text>
              {runningLogs.length === 0 ? (
                <Text style={styles.emptyText}>
                  침략에 사용할 러닝 기록이 없습니다.
                </Text>
              ) : (
                runningLogs.map((log) => (
                  <Pressable
                    key={log.id}
                    style={[
                      styles.option,
                      selectedRunningLogId === log.id && styles.optionSelected,
                    ]}
                    onPress={() => setSelectedRunningLogId(log.id)}
                  >
                    <Text style={styles.optionTitle}>
                      {formatRunningLogLabel(log)}
                    </Text>
                    <Text style={styles.optionMeta}>
                      포인트 {log.earnedPoints} · 면적{' '}
                      {Math.round(log.areaSqm).toLocaleString()}㎡
                    </Text>
                  </Pressable>
                ))
              )}

              <Text style={styles.sectionTitle}>공격 캐릭터</Text>
              {attackCharacters.length === 0 ? (
                <Text style={styles.emptyText}>
                  보유한 공격형 캐릭터가 없습니다.
                </Text>
              ) : (
                attackCharacters.map((character) => (
                  <Pressable
                    key={character.id}
                    style={[
                      styles.option,
                      selectedCharacterId === character.id &&
                        styles.optionSelected,
                    ]}
                    onPress={() => setSelectedCharacterId(character.id)}
                  >
                    <Text style={styles.optionTitle}>{character.name}</Text>
                    <Text style={styles.optionMeta}>
                      {character.grade} · 공격 Lv.{character.attackLv}
                    </Text>
                  </Pressable>
                ))
              )}

              {result ? (
                <View style={styles.resultBox}>
                  <Text style={styles.resultTitle}>{result.message}</Text>
                  <Text style={styles.resultText}>
                    점령률 {result.occupationRateBefore}% →{' '}
                    {result.occupationRateAfter}%
                  </Text>
                  <Text style={styles.resultText}>
                    획득 면적 {Math.round(result.acquiredAreaSqm).toLocaleString()}㎡
                  </Text>
                  <Text style={styles.resultText}>
                    남은 침략 횟수 {result.remainingDailyAttacks}회
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          <Pressable
            style={[
              styles.submitButton,
              (!canSubmitAttack(selectedRunningLogId, selectedCharacterId) ||
                isSubmitting) &&
                styles.submitButtonDisabled,
            ]}
            onPress={submitAttack}
            disabled={
              !canSubmitAttack(selectedRunningLogId, selectedCharacterId) ||
              isSubmitting
            }
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? '침략 요청 중' : '침략하기'}
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
    color: '#151515',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#666666',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText: {
    color: '#555555',
    fontWeight: '600',
  },
  loading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#555555',
  },
  content: {
    paddingBottom: 16,
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#222222',
  },
  emptyText: {
    paddingVertical: 12,
    color: '#777777',
  },
  option: {
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: {
    borderColor: '#E74C3C',
    backgroundColor: '#FFF3F1',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222222',
  },
  optionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#666666',
  },
  resultBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
  },
  resultTitle: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#222222',
  },
  resultText: {
    marginTop: 3,
    color: '#555555',
  },
  submitButton: {
    marginTop: 12,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    backgroundColor: '#E74C3C',
  },
  submitButtonDisabled: {
    backgroundColor: '#C9C9C9',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
