import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CharacterStackParamList } from '../navigation/CharacterStack';

type Nav = StackNavigationProp<CharacterStackParamList, 'Storage'>;

export function StorageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>캐릭터 보관함</Text>
        <TouchableOpacity
          style={styles.gachaBtn}
          onPress={() => navigation.navigate('Gacha')}
        >
          <Text style={styles.gachaBtnIcon}>🎰</Text>
          <Text style={styles.gachaBtnText}>뽑기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.empty}>
        <Text style={styles.emptyText}>보유 캐릭터가 없습니다</Text>
        <Text style={styles.emptySub}>뽑기로 캐릭터를 획득해보세요</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  gachaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2ECC71',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  gachaBtnIcon: { fontSize: 16 },
  gachaBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#888', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#aaa' },
});
