import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Switch, Image, TextInput, ActivityIndicator } from 'react-native';
import { getCharacterImageSource } from '../assets/characters/characterImages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import useAuthStore from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../constants/theme';
import type { MenuStackParamList } from '../navigation/MenuStack';

type Props = StackScreenProps<MenuStackParamList, 'MenuHome'>;

export function MenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateNickname } = useAuthStore();
  const { colors, isDark, toggle } = useTheme();

  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameLoading, setNicknameLoading] = useState(false);

  const handleNicknameEdit = () => {
    setNicknameInput(user?.nickname ?? '');
    setIsEditingNickname(true);
  };

  const handleNicknameConfirm = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed || trimmed === user?.nickname) {
      setIsEditingNickname(false);
      return;
    }
    if (trimmed.length > 50) {
      Alert.alert('닉네임 오류', '닉네임은 50자 이하로 입력해주세요.');
      return;
    }
    setNicknameLoading(true);
    try {
      await updateNickname(trimmed);
      setIsEditingNickname(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '닉네임 변경에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setNicknameLoading(false);
    }
  };

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
            overflow: 'hidden',
          }}>
            {user.representativeCharacter ? (
              <Image
                source={getCharacterImageSource(
                  user.representativeCharacter.grade,
                  user.representativeCharacter.type,
                )}
                style={{ width: 60, height: 60 }}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.bg }}>{user.nickname[0]}</Text>
            )}
          </View>
          {isEditingNickname ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <TextInput
                value={nicknameInput}
                onChangeText={setNicknameInput}
                autoFocus
                maxLength={50}
                style={{
                  fontSize: 16, fontWeight: '700', color: colors.text,
                  borderBottomWidth: 1.5, borderBottomColor: colors.primary,
                  paddingVertical: 2, minWidth: 100, textAlign: 'center',
                }}
                returnKeyType="done"
                onSubmitEditing={handleNicknameConfirm}
              />
              {nicknameLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <TouchableOpacity onPress={handleNicknameConfirm}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>확인</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsEditingNickname(false)}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textMuted }}>취소</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleNicknameEdit}
              style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{user.nickname}</Text>
              <Text style={{ fontSize: 12, color: colors.primary }}>✎</Text>
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2, textAlign: 'center' }}>{user.email}</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{user.points.toLocaleString()}</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' }}>포인트</Text>
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: colors.divider }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{user.totalDistance.toFixed(1)} km</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' }}>총 거리</Text>
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
          {
            label: '내 영토 관리',
            sub: '보유 영토 확인',
            onPress: () => navigation.navigate('MyTerritories'),
          },
          { label: '설정', sub: '알림, 계정 관리' },
          { label: '도움말', sub: '이용 가이드' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 16,
            borderBottomWidth: 1, borderBottomColor: colors.divider,
          }} activeOpacity={0.7} onPress={item.onPress}>
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
