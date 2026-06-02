import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import useAuthStore from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../constants/theme';

export function LoginScreen() {
  const { login, signup } = useAuthStore();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) await signup(email, password);
      else await login(email, password);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '다시 시도해주세요.';
      Alert.alert(isSignUp ? '회원가입 실패' : '로그인 실패', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20,
            backgroundColor: colors.primary,
            justifyContent: 'center', alignItems: 'center', marginBottom: 16,
          }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: colors.bg }}>R</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
            Run Territory
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6 }}>
            달려서 땅을 점령하세요
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>이메일</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface, color: colors.text,
                borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 15, borderWidth: 1, borderColor: colors.divider,
              }}
              placeholder="email@example.com"
              placeholderTextColor={colors.textMuted}
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none"
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>비밀번호</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface, color: colors.text,
                borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
                fontSize: 15, borderWidth: 1, borderColor: colors.divider,
              }}
              placeholder="비밀번호를 입력하세요"
              placeholderTextColor={colors.textMuted}
              value={password} onChangeText={setPassword} secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: colors.primary, borderRadius: radius.md,
              paddingVertical: 16, alignItems: 'center', marginTop: 8,
              opacity: loading ? 0.6 : 1,
            }}
            onPress={handleSubmit} disabled={loading} activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '800' }}>
                {isSignUp ? '회원가입' : '로그인'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setIsSignUp(!isSignUp)}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 24 }}
        >
          <Text style={{ fontSize: 14, color: colors.textMuted }}>
            {isSignUp ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
            {isSignUp ? '로그인' : '회원가입'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
