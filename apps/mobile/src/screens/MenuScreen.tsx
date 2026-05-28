import React from 'react';
import { View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../constants/theme';

export function MenuScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { colors, isDark, toggle } = useTheme();

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: insets.top + 20 }}>
      {/* 프로필 카드 */}
      {user && (
        <View style={{
          backgroundColor: colors.surface, borderRadius: radius.lg,
          padding: 24, alignItems: 'center', marginBottom: 24,
          borderWidth: 1, borderColor: colors.divider,
        }}>
          <View style={{
            width: 60, height: 60, borderRadius: 20,
            backgroundColor: colors.primary,
            justifyContent: 'center', alignItems: 'center', marginBottom: 12,
          }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.bg }}>{user.nickname[0]}</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{user.nickname}</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{user.email}</Text>

          <View style={{ flexDirection: 'row', marginTop: 20, gap: 24 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{user.points.toLocaleString()}</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>포인트</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.divider }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{user.totalDistance.toFixed(1)} km</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>총 거리</Text>
            </View>
          </View>
        </View>
      )}

      {/* 메뉴 항목 */}
      <View style={{
        backgroundColor: colors.surface, borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.divider, overflow: 'hidden',
        marginBottom: 24,
      }}>
        {/* 다크 모드 토글 */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: colors.divider,
        }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>다크 모드</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {isDark ? '어두운 테마 사용 중' : '밝은 테마 사용 중'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggle}
            trackColor={{ false: colors.divider, true: colors.primaryDim }}
            thumbColor={isDark ? colors.primary : '#f4f3f4'}
          />
        </View>

        {[
          { label: '내 영토 관리', sub: '보유 영토 확인' },
          { label: '설정', sub: '알림, 계정 관리' },
          { label: '도움말', sub: '이용 가이드' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 16,
            borderBottomWidth: 1, borderBottomColor: colors.divider,
          }} activeOpacity={0.7}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.sub}</Text>
            </View>
            <Text style={{ fontSize: 20, color: colors.textMuted }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: colors.dangerDim, borderRadius: radius.md,
          paddingVertical: 14, alignItems: 'center',
        }}
        onPress={handleLogout} activeOpacity={0.8}
      >
        <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>로그아웃</Text>
      </TouchableOpacity>
    </View>
  );
}
