import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import useAuthStore from '../store/authStore';

export function MenuScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      {user && (
        <View style={styles.profile}>
          <Text style={styles.nickname}>{user.nickname}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
      )}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12121F' },
  profile: { alignItems: 'center', marginBottom: 32 },
  nickname: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  email: { color: '#888', fontSize: 14, marginTop: 4 },
  logoutButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
