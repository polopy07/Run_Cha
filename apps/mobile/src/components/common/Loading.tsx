import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
